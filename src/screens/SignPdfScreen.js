import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Image,
  PanResponder,
  useWindowDimensions,
  PixelRatio,
} from 'react-native';
import { PDFDocument } from 'pdf-lib';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RFValue } from 'react-native-responsive-fontsize';
import Screen from '../components/Screen';
import Header from '../components/Header';
import SignaturePad from '../utils/SignaturePad';
import PdfPagePreview from '../utils/PdfPagePreview';
import { pickPdfFile } from '../utils/pickPdfFile';
import { estimateBase64Size, formatBytes } from '../utils/fileSize';
import { colors, spacing, radius, typography, shadow } from '../theme';

// The signature's own size relative to the page's displayed width - used
// both for the draggable preview overlay and the final stamped size, so
// what you see while positioning it matches the applied result exactly.
const SIGNATURE_WIDTH_RATIO = 0.35;
const SIGNATURE_MARGIN_RATIO = 0.05;

const ANDROID_DOWNLOADS_URI = 'content://com.android.externalstorage.documents/document/primary:Download';

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// Draggable overlay for positioning the signature on the page preview.
// Refs (not the raw props) back the pan handlers so a second drag starts
// from the signature's actual current spot rather than a stale closure from
// when PanResponder.create() first ran - the same fix PageEditScreen.js's
// corner handles needed for the same reason.
function DraggableSignature({ uri, position, size, bounds, onMove }) {
  const positionRef = useRef(position);
  positionRef.current = position;
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const gestureStart = useRef(position);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        gestureStart.current = positionRef.current;
      },
      onPanResponderMove: (_evt, gesture) => {
        const b = boundsRef.current;
        const s = sizeRef.current;
        onMove({
          x: clamp(gestureStart.current.x + gesture.dx, 0, Math.max(b.width - s.width, 0)),
          y: clamp(gestureStart.current.y + gesture.dy, 0, Math.max(b.height - s.height, 0)),
        });
      },
    })
  ).current;

  return (
    <Image
      {...pan.panHandlers}
      source={{ uri }}
      resizeMode="contain"
      style={[
        styles.dragSignature,
        { left: position.x, top: position.y, width: size.width, height: size.height },
      ]}
    />
  );
}

export default function SignPdfScreen({ navigation }) {
  const padRef = useRef(null);
  const previewRef = useRef(null);
  const { width: windowWidth } = useWindowDimensions();
  const pixelRatio = PixelRatio.get();

  // 'draw' -> 'position' -> 'result'
  const [stage, setStage] = useState('draw');
  const [pickedFile, setPickedFile] = useState(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [preparingPosition, setPreparingPosition] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);

  const [signatureUri, setSignatureUri] = useState(null);
  const [signatureNaturalSize, setSignatureNaturalSize] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewAreaSize, setPreviewAreaSize] = useState(null);
  const [sigPosition, setSigPosition] = useState(null);

  const pickFile = async () => {
    try {
      const file = await pickPdfFile('signpdf-input');
      if (!file) return;
      setPickedFile(file);
      setHasSignature(false);
      setResult(null);
      setStage('draw');
    } catch (error) {
      console.error('Error preparing picked PDF:', error);
      Alert.alert('Error', 'Could not open this PDF. Please try a different file.');
    }
  };

  const clearSignature = () => {
    padRef.current?.clear();
    setHasSignature(false);
  };

  // Captures the drawn signature, rasterizes the last page for preview, and
  // works out where the draggable overlay's box should start (bottom-right,
  // matching the fixed spot the feature used before positioning existed).
  const proceedToPosition = async () => {
    if (!pickedFile || !hasSignature) return;
    setPreparingPosition(true);
    try {
      const signatureBase64 = await padRef.current.capture();
      const sigUri = `${FileSystem.cacheDirectory}signature-${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(sigUri, signatureBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const sigSize = await new Promise((resolve, reject) => {
        Image.getSize(sigUri, (width, height) => resolve({ width, height }), reject);
      });

      const { pageCount } = await previewRef.current.load({ uri: pickedFile.uri });
      const rendered = await previewRef.current.renderPage({
        pageNumber: pageCount,
        targetWidth: windowWidth,
        pixelRatio,
      });

      setSignatureUri(sigUri);
      setSignatureNaturalSize(sigSize);
      setPreviewImage(rendered);
      setPreviewAreaSize(null);
      setSigPosition(null);
      setStage('position');
    } catch (error) {
      console.error('Error preparing signature placement:', error);
      Alert.alert('Error', 'Could not prepare this PDF for positioning. Please try again.');
    } finally {
      setPreparingPosition(false);
    }
  };

  // Fits the rendered page inside the measured preview box (same
  // scale-to-smaller-ratio approach used for photo previews elsewhere in
  // the app), then sizes/positions the draggable signature relative to it.
  let previewDisplay = null;
  let sigDisplaySize = null;
  if (previewImage && previewAreaSize && previewAreaSize.width > 0 && previewAreaSize.height > 0) {
    const fitScale = Math.min(
      previewAreaSize.width / previewImage.pointWidth,
      previewAreaSize.height / previewImage.pointHeight
    );
    const displayWidth = previewImage.pointWidth * fitScale;
    const displayHeight = previewImage.pointHeight * fitScale;
    previewDisplay = { width: displayWidth, height: displayHeight };

    if (signatureNaturalSize) {
      const sigWidth = displayWidth * SIGNATURE_WIDTH_RATIO;
      const sigHeight = sigWidth * (signatureNaturalSize.height / signatureNaturalSize.width);
      sigDisplaySize = { width: sigWidth, height: sigHeight };
    }
  }

  // Sets the signature's starting position (bottom-right) exactly once,
  // as soon as both the preview and its display size are known - guarded so
  // it doesn't keep re-centering the signature while the user is dragging it.
  if (previewDisplay && sigDisplaySize && !sigPosition) {
    const margin = previewDisplay.width * SIGNATURE_MARGIN_RATIO;
    setSigPosition({
      x: previewDisplay.width - sigDisplaySize.width - margin,
      y: previewDisplay.height - sigDisplaySize.height - margin,
    });
  }

  const resetPosition = () => {
    if (!previewDisplay || !sigDisplaySize) return;
    const margin = previewDisplay.width * SIGNATURE_MARGIN_RATIO;
    setSigPosition({
      x: previewDisplay.width - sigDisplaySize.width - margin,
      y: previewDisplay.height - sigDisplaySize.height - margin,
    });
  };

  const redoSignature = () => {
    setStage('draw');
    setHasSignature(false);
    setPreviewImage(null);
    setSignatureUri(null);
    setSignatureNaturalSize(null);
    setSigPosition(null);
  };

  const applySignature = async () => {
    if (!pickedFile || !signatureUri || !previewImage || !previewDisplay || !sigPosition || !sigDisplaySize) return;
    setApplying(true);
    try {
      const signatureBase64 = await FileSystem.readAsStringAsync(signatureUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const pdfBase64 = await FileSystem.readAsStringAsync(pickedFile.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const pdfDoc = await PDFDocument.load(pdfBase64);
      const pngImage = await pdfDoc.embedPng(signatureBase64);
      const pages = pdfDoc.getPages();
      const page = pages[pages.length - 1];

      // Converts the dragged position (top-left origin, in displayed-preview
      // pixels) into PDF point space (bottom-left origin, in the page's own
      // units) - the two coordinate systems don't share an origin or axis
      // direction, so both the flip and the scale factor matter here.
      const pointsPerPixel = previewImage.pointWidth / previewDisplay.width;
      const sigWidthPoints = sigDisplaySize.width * pointsPerPixel;
      const sigHeightPoints = sigDisplaySize.height * pointsPerPixel;
      const xPoints = sigPosition.x * pointsPerPixel;
      const yPointsFromTop = sigPosition.y * pointsPerPixel;
      const yPoints = previewImage.pointHeight - yPointsFromTop - sigHeightPoints;

      page.drawImage(pngImage, { x: xPoints, y: yPoints, width: sigWidthPoints, height: sigHeightPoints });

      const signedBase64 = await pdfDoc.saveAsBase64();
      setResult({ base64: signedBase64, size: estimateBase64Size(signedBase64) });
      setStage('result');
    } catch (error) {
      console.error('Error signing PDF:', error);
      Alert.alert('Error', 'Could not sign this PDF. It may be corrupted or password-protected.');
    } finally {
      setApplying(false);
    }
  };

  const signedFileName = () => {
    const base = (pickedFile?.name || 'document.pdf').replace(/\.pdf$/i, '').replace(/^Signed_/i, '');
    return `Signed_${base}.pdf`;
  };

  const saveOrShare = async () => {
    if (!result) return;
    try {
      const fileName = signedFileName();
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

      await Sharing.shareAsync(pdfUri, { mimeType: 'application/pdf', dialogTitle: 'Save Signed PDF' });
    } catch (error) {
      console.error('Error saving signed PDF:', error);
      Alert.alert('Error', 'Failed to save the signed PDF.');
    }
  };

  const startOver = () => {
    setPickedFile(null);
    setHasSignature(false);
    setResult(null);
    setPreviewImage(null);
    setSignatureUri(null);
    setSignatureNaturalSize(null);
    setSigPosition(null);
    setStage('draw');
  };

  return (
    <Screen>
      <Header title="Sign PDF" subtitle="Stamp your signature onto any PDF" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!pickedFile ? (
          <TouchableOpacity style={styles.pickCard} onPress={pickFile} activeOpacity={0.8}>
            <View style={styles.pickIconWrap}>
              <Ionicons name="create-outline" size={32} color={colors.accent} />
            </View>
            <Text style={styles.pickTitle}>Choose a PDF</Text>
            <Text style={styles.pickBody}>Pick any PDF from your device to sign.</Text>
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

            {stage === 'draw' && (
              <>
                <View style={styles.padHeader}>
                  <Text style={styles.sectionLabel}>Draw Your Signature</Text>
                  <TouchableOpacity onPress={clearSignature} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.clearText}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.padWrap}>
                  <SignaturePad ref={padRef} onStrokeStart={() => setHasSignature(true)} />
                </View>

                <TouchableOpacity
                  style={[styles.applyButton, (!hasSignature || preparingPosition) && styles.applyButtonDisabled]}
                  onPress={proceedToPosition}
                  disabled={!hasSignature || preparingPosition}
                >
                  {preparingPosition ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.applyButtonText}>Next: Position Signature</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {stage === 'position' && (
              <>
                <View style={styles.padHeader}>
                  <Text style={styles.sectionLabel}>Drag to Position</Text>
                  <TouchableOpacity onPress={redoSignature} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.clearText}>Redo Signature</Text>
                  </TouchableOpacity>
                </View>
                <View
                  style={styles.previewWrap}
                  onLayout={(e) => setPreviewAreaSize(e.nativeEvent.layout)}
                >
                  {previewDisplay && (
                    <View style={{ width: previewDisplay.width, height: previewDisplay.height }}>
                      <Image
                        source={{ uri: previewImage.uri }}
                        style={{ width: previewDisplay.width, height: previewDisplay.height }}
                        resizeMode="contain"
                      />
                      {sigPosition && sigDisplaySize && (
                        <DraggableSignature
                          uri={signatureUri}
                          position={sigPosition}
                          size={sigDisplaySize}
                          bounds={previewDisplay}
                          onMove={setSigPosition}
                        />
                      )}
                    </View>
                  )}
                </View>
                <Text style={styles.padHint}>Drag the signature anywhere on the page.</Text>

                <View style={styles.positionActions}>
                  <TouchableOpacity style={styles.resetButton} onPress={resetPosition}>
                    <Text style={styles.resetButtonText}>Reset Position</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.applyButton, styles.applyButtonInline, applying && styles.applyButtonDisabled]}
                    onPress={applySignature}
                    disabled={applying}
                  >
                    {applying ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.applyButtonText}>Apply Signature</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {stage === 'result' && result && (
              <View style={styles.resultCard}>
                <Ionicons name="checkmark-circle" size={40} color={colors.accent} style={styles.resultIcon} />
                <Text style={styles.resultTitle}>Signed successfully</Text>
                <Text style={styles.resultMeta}>{signedFileName()} · {formatBytes(result.size)}</Text>
                <TouchableOpacity style={styles.applyButton} onPress={saveOrShare}>
                  <Text style={styles.applyButtonText}>Save / Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tryAgainButton} onPress={startOver}>
                  <Text style={styles.tryAgainText}>Sign Another</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <PdfPagePreview ref={previewRef} />
    </Screen>
  );
}

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
  padHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  clearText: {
    ...typography.label,
    color: colors.accent,
  },
  padWrap: {
    height: 220,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  previewWrap: {
    height: 380,
    backgroundColor: '#000',
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragSignature: {
    position: 'absolute',
  },
  padHint: {
    ...typography.label,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  positionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  resetButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  resetButtonText: {
    ...typography.label,
    color: colors.textMuted,
  },
  applyButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  applyButtonInline: {
    flex: 1,
    marginTop: 0,
  },
  applyButtonDisabled: {
    opacity: 0.4,
  },
  applyButtonText: {
    ...typography.button,
    color: colors.white,
    textAlign: 'center',
    fontSize: RFValue(16),
  },
  resultCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
    marginTop: spacing.xl,
    ...shadow,
  },
  resultIcon: {
    marginBottom: spacing.sm,
  },
  resultTitle: {
    ...typography.title,
    fontSize: RFValue(18),
  },
  resultMeta: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  tryAgainButton: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  tryAgainText: {
    ...typography.label,
    color: colors.textMuted,
  },
});
