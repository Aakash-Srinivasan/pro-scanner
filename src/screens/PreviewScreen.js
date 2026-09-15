import React, { useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Alert, Text, Image, FlatList, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Screen from '../components/Screen';
import Header from '../components/Header';
import ImageProcessor from '../utils/ImageProcessor';
import { buildPdfFromPages } from '../utils/buildPdf';
import { addWatermarkToPdf } from '../utils/watermarkPdf';
import { estimateBase64Size, formatBytes } from '../utils/fileSize';
import { useScanSession } from '../context/ScanSessionContext';
import { resetTo } from '../utils/navigation';
import { colors, spacing, radius, typography, shadow } from '../theme';

const QUALITY_PRESETS = [
  { key: 'low', label: 'Low', quality: 0.35 },
  { key: 'medium', label: 'Medium', quality: 0.6 },
  { key: 'high', label: 'High', quality: 0.85 },
];

export default function PreviewScreen({ route, navigation }) {
  const { pageThumbnails = [], suggestedName } = route.params;
  const { clearSession } = useScanSession();
  const [baseName, setBaseName] = useState(suggestedName || 'ProScanned');
  const [editingName, setEditingName] = useState(false);
  const [pdfBytes, setPdfBytes] = useState(route.params.pdfBytes);
  const fileNameInputRef = useRef(null);
  const processorRef = useRef(null);

  const [showReduce, setShowReduce] = useState(false);
  const [computingSizes, setComputingSizes] = useState(false);
  const [sizeOptions, setSizeOptions] = useState(null);
  const [appliedPreset, setAppliedPreset] = useState(null);

  const [showWatermark, setShowWatermark] = useState(false);
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [applyingWatermark, setApplyingWatermark] = useState(false);
  const [appliedWatermark, setAppliedWatermark] = useState(null);

  // The ".pdf" suffix is fixed, not part of the editable text - the user
  // only ever edits the base name, so there's no risk of them removing or
  // mistyping the extension.
  const getFullFileName = () => `${baseName.trim() || 'ProScanned'}.pdf`;

  // A blank name isn't a valid file name - rather than only catching this
  // silently at save/export time, snap straight back to the original
  // suggested name the moment editing ends, so the user sees it happen
  // instead of the field just looking empty until they try to save.
  const finishEditingName = () => {
    setEditingName(false);
    if (!baseName.trim()) {
      setBaseName(suggestedName || 'ProScanned');
    }
  };

  // expo-file-system's documentDirectory is sandboxed to the app and never
  // shows up in the iOS Files app or Android's file browser on its own -
  // the only reliable cross-platform way to hand the user a real, keepable
  // file is to write it locally, then let the OS share sheet place it
  // (Save to Files, AirDrop, Drive, etc.).
  const exportPdf = async () => {
    if (!pdfBytes) return null;
    const pdfUri = `${FileSystem.documentDirectory}${getFullFileName()}`;
    await FileSystem.writeAsStringAsync(pdfUri, pdfBytes, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return pdfUri;
  };

  // Android lets an app write straight into a user-chosen public folder (like
  // Downloads) via the Storage Access Framework - no share sheet needed.
  // iOS has no equivalent: every app is sandboxed, and the share sheet's
  // "Save to Files" is the only way off the sandbox, so it keeps using that.
  const ANDROID_DOWNLOADS_URI = 'content://com.android.externalstorage.documents/document/primary:Download';

  const saveToDownloadsAndroid = async (pdfUri, fileName) => {
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
      ANDROID_DOWNLOADS_URI
    );
    if (!permissions.granted) {
      return false;
    }

    const base64 = await FileSystem.readAsStringAsync(pdfUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      fileName,
      'application/pdf'
    );
    await FileSystem.writeAsStringAsync(destUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return true;
  };

  // Returns true when the file was written straight to a folder (no share
  // sheet involved) - the caller uses this to know a save is fully done.
  const saveDirectly = async (pdfUri) => {
    if (Platform.OS === 'android') {
      const saved = await saveToDownloadsAndroid(pdfUri, getFullFileName());
      if (saved) {
        return true;
      }
      // User declined the folder picker - fall back to the share sheet
      // rather than doing nothing.
    }
    await Sharing.shareAsync(pdfUri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Save PDF',
    });
    return false;
  };

  const savePDF = async () => {
    try {
      const pdfUri = await exportPdf();
      if (!pdfUri) return;
      const savedDirectly = await saveDirectly(pdfUri);
      if (savedDirectly) {
        Alert.alert('Saved', `${getFullFileName()} was saved to your chosen folder.`, [
          {
            text: 'OK',
            onPress: () => {
              clearSession();
              resetTo(navigation, 'Home');
            },
          },
        ]);
      }
    } catch (error) {
      console.error('Error saving PDF:', error);
      Alert.alert('Error', 'Failed to save PDF');
    }
  };

  const sharePDF = async () => {
    try {
      const pdfUri = await exportPdf();
      if (!pdfUri) return;
      await Sharing.shareAsync(pdfUri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      console.error('Error sharing PDF:', error);
      Alert.alert('Error', 'Failed to share PDF');
    }
  };

  const handleDownload = async () => {
    try {
      const pdfUri = await exportPdf();
      if (!pdfUri) return;
      await saveDirectly(pdfUri);
      navigation.navigate('Download');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      Alert.alert('Error', 'Failed to download PDF');
    }
  };

  // Recompresses every page at each quality preset and reports the resulting
  // PDF size for each, so the user can compare before picking one - rather
  // than guessing at a quality slider blind.
  const openReduceSize = async () => {
    setShowReduce(true);
    if (sizeOptions) return;

    setComputingSizes(true);
    try {
      const results = {};
      for (const preset of QUALITY_PRESETS) {
        const recompressedUris = [];
        for (const uri of pageThumbnails) {
          const outUri = await processorRef.current.process({ uri, quality: preset.quality });
          recompressedUris.push(outUri);
        }
        const compressedBytes = await buildPdfFromPages(recompressedUris.map((uri) => ({ uri })));
        results[preset.key] = {
          pdfBytes: compressedBytes,
          size: estimateBase64Size(compressedBytes),
        };
      }
      setSizeOptions(results);
    } catch (error) {
      console.error('Error computing size options:', error);
      Alert.alert('Error', 'Could not calculate size options. Please try again.');
      setShowReduce(false);
    } finally {
      setComputingSizes(false);
    }
  };

  const applyPreset = (key) => {
    const option = sizeOptions?.[key];
    if (!option) return;
    setPdfBytes(option.pdfBytes);
    setAppliedPreset(key);
    setShowReduce(false);
  };

  // Lets the user grab a single page as a plain JPEG - useful when they only
  // need one photo, not the whole PDF (e.g. attaching a page to a chat).
  const sharePageImage = async (uri) => {
    try {
      await Sharing.shareAsync(uri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Share Page Image',
      });
    } catch (error) {
      console.error('Error sharing page image:', error);
      Alert.alert('Error', 'Failed to share this page.');
    }
  };

  const applyWatermark = async () => {
    const text = watermarkText.trim();
    if (!text) return;
    setApplyingWatermark(true);
    try {
      const stamped = await addWatermarkToPdf(pdfBytes, text);
      setPdfBytes(stamped);
      setAppliedWatermark(text);
      setShowWatermark(false);
    } catch (error) {
      console.error('Error applying watermark:', error);
      Alert.alert('Error', 'Could not add the watermark. Please try again.');
    } finally {
      setApplyingWatermark(false);
    }
  };

  const handleRescan = () => {
    Alert.alert('Start New Scan', 'This scan is already saved in your History. Start a new one?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start New',
        onPress: () => {
          clearSession();
          navigation.navigate('Camera');
        },
      },
    ]);
  };

  return (
    <Screen>
      <Header title="Preview" onBack={() => navigation.goBack()} />

      <View style={styles.editRow}>
        <Text style={styles.label}>Name:</Text>
        <View style={styles.inputWrap}>
          {editingName ? (
            <TextInput
              ref={fileNameInputRef}
              style={styles.input}
              value={baseName}
              onChangeText={setBaseName}
              placeholder="Enter file name"
              placeholderTextColor={colors.textMuted}
              textAlignVertical="center"
              autoFocus
              selectTextOnFocus
              onSubmitEditing={finishEditingName}
              onBlur={finishEditingName}
              returnKeyType="done"
            />
          ) : (
            // Read-only display so the full name is always readable at a
            // glance, instead of a live TextInput that scrolls to hide
            // whichever end of a long auto-generated name isn't focused.
            <Text style={styles.nameDisplay} numberOfLines={2} ellipsizeMode="middle">
              {baseName}
            </Text>
          )}
          <Text style={styles.extension}>.pdf</Text>
        </View>
        <TouchableOpacity
          onPress={() => (editingName ? finishEditingName() : setEditingName(true))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={editingName ? 'checkmark' : 'pencil'}
            size={18}
            color={editingName ? colors.accent : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      <FlatList
        data={pageThumbnails}
        keyExtractor={(uri) => uri}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.previewList}
        renderItem={({ item: uri, index }) => (
          <View style={styles.previewCard}>
            <Image source={{ uri }} style={styles.previewImage} resizeMode="contain" />
            <TouchableOpacity
              style={styles.pageShareButton}
              onPress={() => sharePageImage(uri)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="share-outline" size={16} color={colors.accent} />
            </TouchableOpacity>
            <Text style={styles.previewLabel}>Page {index + 1}</Text>
          </View>
        )}
      />

      <TouchableOpacity style={styles.reduceRow} onPress={openReduceSize}>
        <Ionicons name="speedometer-outline" size={16} color={colors.accent} />
        <Text style={styles.reduceText}>
          Reduce File Size
          {appliedPreset ? ` (using ${QUALITY_PRESETS.find((p) => p.key === appliedPreset)?.label})` : ''}
        </Text>
      </TouchableOpacity>

      {showReduce && (
        <View style={styles.reducePanel}>
          {computingSizes ? (
            <View style={styles.reduceLoading}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.reduceLoadingText}>Calculating sizes...</Text>
            </View>
          ) : (
            <>
              <View style={styles.presetRow}>
                <Text style={styles.presetLabel}>Current</Text>
                <Text style={styles.presetSize}>{formatBytes(estimateBase64Size(pdfBytes))}</Text>
              </View>
              {QUALITY_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.key}
                  style={[styles.presetRow, appliedPreset === preset.key && styles.presetRowActive]}
                  onPress={() => applyPreset(preset.key)}
                >
                  <Text style={styles.presetLabel}>{preset.label}</Text>
                  <Text style={styles.presetSize}>
                    {sizeOptions?.[preset.key] ? formatBytes(sizeOptions[preset.key].size) : '--'}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setShowReduce(false)} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.reduceRow} onPress={() => setShowWatermark((prev) => !prev)}>
        <Ionicons name="pricetag-outline" size={16} color={colors.accent} />
        <Text style={styles.reduceText}>
          Add Watermark
          {appliedWatermark ? ` ("${appliedWatermark}")` : ''}
        </Text>
      </TouchableOpacity>

      {showWatermark && (
        <View style={styles.reducePanel}>
          <TextInput
            style={styles.watermarkInput}
            value={watermarkText}
            onChangeText={setWatermarkText}
            placeholder="Watermark text"
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.watermarkActions}>
            <TouchableOpacity onPress={() => setShowWatermark(false)} style={styles.watermarkCancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.watermarkApplyButton, (!watermarkText.trim() || applyingWatermark) && styles.watermarkApplyDisabled]}
              onPress={applyWatermark}
              disabled={!watermarkText.trim() || applyingWatermark}
            >
              {applyingWatermark ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.watermarkApplyText}>Apply</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.buttonBar}>
        <View style={styles.actionItem}>
          <TouchableOpacity style={styles.actionCircle} onPress={handleDownload} activeOpacity={0.75}>
            <Ionicons name="download-outline" size={22} color={colors.accent} />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Download</Text>
        </View>
        <View style={styles.actionItem}>
          <TouchableOpacity style={styles.actionCircle} onPress={savePDF} activeOpacity={0.75}>
            <Ionicons name="save-outline" size={22} color={colors.accent} />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Save</Text>
        </View>
        <View style={styles.actionItem}>
          <TouchableOpacity style={styles.actionCircle} onPress={sharePDF} activeOpacity={0.75}>
            <Ionicons name="share-outline" size={22} color={colors.accent} />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Share</Text>
        </View>
        <View style={styles.actionItem}>
          <TouchableOpacity style={styles.actionCircle} onPress={handleRescan} activeOpacity={0.75}>
            <Ionicons name="refresh-outline" size={22} color={colors.accent} />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>New Scan</Text>
        </View>
      </View>

      <ImageProcessor ref={processorRef} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.text,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    ...typography.body,
  },
  nameDisplay: {
    flex: 1,
    minWidth: 0,
    ...typography.body,
  },
  extension: {
    ...typography.body,
    color: colors.textMuted,
  },
  previewList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
  },
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginRight: spacing.md,
    ...shadow,
  },
  pageShareButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  previewImage: {
    width: 220,
    height: 300,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },
  previewLabel: {
    ...typography.label,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  reduceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  reduceText: {
    ...typography.label,
    color: colors.accent,
  },
  reducePanel: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow,
  },
  reduceLoading: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  reduceLoadingText: {
    ...typography.label,
    color: colors.textMuted,
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  presetRowActive: {
    backgroundColor: colors.accentSoft,
  },
  presetLabel: {
    ...typography.body,
    fontFamily: 'Nunito-Bold',
  },
  presetSize: {
    ...typography.body,
    color: colors.textMuted,
  },
  cancelButton: {
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelText: {
    ...typography.label,
    color: colors.textMuted,
  },
  watermarkInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  watermarkActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  watermarkCancelButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  watermarkApplyButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    minWidth: 72,
    alignItems: 'center',
  },
  watermarkApplyDisabled: {
    opacity: 0.4,
  },
  watermarkApplyText: {
    ...typography.button,
    color: colors.white,
  },
  buttonBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    ...shadow,
  },
  actionItem: {
    alignItems: 'center',
  },
  actionCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...typography.label,
    color: colors.text,
    marginTop: spacing.xs,
  },
});
