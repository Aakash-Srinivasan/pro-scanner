import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, ScrollView } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RFValue } from 'react-native-responsive-fontsize';
import Screen from '../components/Screen';
import Header from '../components/Header';
import PdfCompressor from '../utils/PdfCompressor';
import { buildPdfFromRasterPages } from '../utils/buildPdf';
import { pickPdfFile } from '../utils/pickPdfFile';
import { estimateBase64Size, formatBytes } from '../utils/fileSize';
import { useTheme } from '../context/ThemeContext';

// Resolution + JPEG quality pairs. Resolution (renderScale) matters more
// than JPEG quality for legibility here, since a whole page is being
// rasterized - a low-res render looks blurry no matter the JPEG quality.
const COMPRESSION_PRESETS = [
  { key: 'low', label: 'Low', description: 'Smallest file, lower detail', quality: 0.4, renderScale: 1.0 },
  { key: 'medium', label: 'Medium', description: 'Balanced', quality: 0.6, renderScale: 1.3 },
  { key: 'high', label: 'High', description: 'Best detail, larger file', quality: 0.8, renderScale: 1.6 },
];

const ANDROID_DOWNLOADS_URI = 'content://com.android.externalstorage.documents/document/primary:Download';

export default function PdfCompressorScreen({ navigation }) {
  const { colors, spacing, radius, typography, shadow } = useTheme();
  const processorRef = useRef(null);
  const [pickedFile, setPickedFile] = useState(null);
  const [presetKey, setPresetKey] = useState('medium');
  const [compressing, setCompressing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);

  const pickFile = async () => {
    try {
      const file = await pickPdfFile('pdfcompressor-input');
      if (!file) return;
      setPickedFile(file);
      setResult(null);
      setProgress(null);
    } catch (error) {
      console.error('Error preparing picked PDF:', error);
      Alert.alert('Error', 'Could not open this PDF. Please try a different file.');
    }
  };

  const runCompression = async () => {
    if (!pickedFile) return;
    const preset = COMPRESSION_PRESETS.find((p) => p.key === presetKey);
    setCompressing(true);
    setProgress(null);
    try {
      const { pages } = await processorRef.current.compress(
        { uri: pickedFile.uri, quality: preset.quality, renderScale: preset.renderScale },
        (current, total) => setProgress({ current, total })
      );
      const compressedBase64 = await buildPdfFromRasterPages(pages);
      setResult({ base64: compressedBase64, size: estimateBase64Size(compressedBase64) });

      // The rasterized page images were only needed to build the bytes
      // above - without this, every compression attempt leaves one temp
      // image per page behind in the cache directory forever.
      for (const page of pages) {
        FileSystem.deleteAsync(page.uri, { idempotent: true }).catch(() => {});
      }
    } catch (error) {
      console.error('Error compressing PDF:', error);
      Alert.alert('Error', 'Could not compress this PDF. It may be corrupted or password-protected.');
    } finally {
      setCompressing(false);
      setProgress(null);
    }
  };

  const compressedFileName = () => {
    const base = (pickedFile?.name || 'document.pdf').replace(/\.pdf$/i, '');
    return `Compressed_${base}.pdf`;
  };

  // Mirrors PreviewScreen's save flow: Android can write straight into a
  // user-chosen public folder via the Storage Access Framework, everything
  // else (declined, or iOS which has no such API) falls back to the share
  // sheet's "Save to Files".
  const saveOrShare = async () => {
    if (!result) return;
    try {
      const fileName = compressedFileName();
      const pdfUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(pdfUri, result.base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
          ANDROID_DOWNLOADS_URI
        );
        if (permissions.granted) {
          const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            'application/pdf'
          );
          await FileSystem.writeAsStringAsync(destUri, result.base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          Alert.alert('Saved', `${fileName} was saved to your chosen folder.`);
          return;
        }
      }

      await Sharing.shareAsync(pdfUri, { mimeType: 'application/pdf', dialogTitle: 'Save Compressed PDF' });
    } catch (error) {
      console.error('Error saving compressed PDF:', error);
      Alert.alert('Error', 'Failed to save the compressed PDF.');
    }
  };

  const startOver = () => {
    setPickedFile(null);
    setResult(null);
    setProgress(null);
  };

  const styles = StyleSheet.create({
    scrollView: {
      // flex: 1,
    },
    content: {
      padding: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    pickCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      padding: spacing.xxl,
      marginTop: spacing.xl,
    },
    pickIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    pickTitle: {
      ...typography.title,
      fontSize: RFValue(18),
    },
    pickBody: {
      ...typography.subtitle,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    fileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.md,
      ...shadow,
    },
    fileInfo: {
      flex: 1,
    },
    fileName: {
      ...typography.body,
      fontFamily: 'Nunito-Bold',
    },
    fileMeta: {
      ...typography.label,
      color: colors.textMuted,
      marginTop: 2,
    },
    sectionLabel: {
      ...typography.label,
      color: colors.textMuted,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    presetGroup: {
      gap: spacing.sm,
    },
    presetOption: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    presetOptionActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    presetOptionLabel: {
      ...typography.body,
      fontFamily: 'Nunito-Bold',
      color: colors.text,
    },
    presetOptionLabelActive: {
      color: colors.accent,
    },
    presetOptionDesc: {
      ...typography.label,
      color: colors.textMuted,
      marginTop: 2,
    },
    compressButton: {
      backgroundColor: colors.accent,
      borderRadius: radius.pill,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.xl,
    },
    compressButtonText: {
      ...typography.button,
      color: colors.white,
      fontSize: RFValue(16),
    },
    progressText: {
      ...typography.label,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    resultCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.lg,
      marginTop: spacing.xl,
      ...shadow,
    },
    resultRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    resultLabel: {
      ...typography.body,
      color: colors.textMuted,
    },
    resultValue: {
      ...typography.body,
      fontFamily: 'Nunito-Bold',
    },
    resultValueAccent: {
      color: colors.accent,
    },
    tryAgainButton: {
      alignItems: 'center',
      marginTop: spacing.md,
    },
    tryAgainText: {
      ...typography.label,
      color: colors.textMuted,
    },
    tipCard: {
      flexDirection: 'row',
      gap: spacing.sm,
      backgroundColor: colors.accentSoft,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.xl,
    },
    tipText: {
      ...typography.label,
      fontFamily: 'Nunito-Regular',
      color: colors.text,
      flex: 1,
      lineHeight: RFValue(18),
    },
  });

  return (
    <Screen>
      <Header title="Compress PDF" subtitle="Shrink any PDF on your device" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!pickedFile ? (
          <TouchableOpacity style={styles.pickCard} onPress={pickFile} activeOpacity={0.8}>
            <View style={styles.pickIconWrap}>
              <Ionicons name="document-attach-outline" size={32} color={colors.accent} />
            </View>
            <Text style={styles.pickTitle}>Choose a PDF</Text>
            <Text style={styles.pickBody}>Pick any PDF from your device to reduce its file size.</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.fileCard}>
              <Ionicons name="document-text-outline" size={28} color={colors.accent} />
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>{pickedFile.name}</Text>
                <Text style={styles.fileMeta}>{formatBytes(pickedFile.size)}</Text>
              </View>
              <TouchableOpacity onPress={startOver} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {!result && (
              <>
                <Text style={styles.sectionLabel}>Quality</Text>
                <View style={styles.presetGroup}>
                  {COMPRESSION_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.key}
                      style={[styles.presetOption, presetKey === preset.key && styles.presetOptionActive]}
                      onPress={() => setPresetKey(preset.key)}
                      disabled={compressing}
                    >
                      <Text style={[styles.presetOptionLabel, presetKey === preset.key && styles.presetOptionLabelActive]}>
                        {preset.label}
                      </Text>
                      <Text style={styles.presetOptionDesc}>{preset.description}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={styles.compressButton} onPress={runCompression} disabled={compressing}>
                  {compressing ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.compressButtonText}>Compress</Text>
                  )}
                </TouchableOpacity>

                {compressing && (
                  <Text style={styles.progressText}>
                    {progress ? `Rendering page ${progress.current} of ${progress.total}...` : 'Preparing...'}
                  </Text>
                )}
              </>
            )}

            {result && (
              <View style={styles.resultCard}>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Original</Text>
                  <Text style={styles.resultValue}>{formatBytes(pickedFile.size)}</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Compressed</Text>
                  <Text style={[styles.resultValue, styles.resultValueAccent]}>{formatBytes(result.size)}</Text>
                </View>
                <TouchableOpacity style={styles.compressButton} onPress={saveOrShare}>
                  <Text style={styles.compressButtonText}>Save / Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tryAgainButton} onPress={startOver}>
                  <Text style={styles.tryAgainText}>Compress Another</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={18} color={colors.accent} />
          <Text style={styles.tipText}>
            Works best on scanned or photographed PDFs. A PDF with real, selectable text will lose that
            selectable text after compression, since each page is turned into a picture first.
          </Text>
        </View>
      </ScrollView>

      <PdfCompressor ref={processorRef} />
    </Screen>
  );
}
