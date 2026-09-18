import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RFValue } from 'react-native-responsive-fontsize';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useScanSession } from '../context/ScanSessionContext';
import { MAX_PAGES_PER_DOCUMENT } from '../utils/scanLimits';
import { resetTo } from '../utils/navigation';
import { hasSeenCameraCoachmarks, markCameraCoachmarksSeen } from '../utils/coachmarks';
import Screen from '../components/Screen';
import Header from '../components/Header';
import Button from '../components/Button';
import { useTheme } from '../context/ThemeContext';

// A URL is offered an "Open" action; anything else (plain text, a
// contact card, a wifi config, etc.) only gets "Copy".
const isLikelyUrl = (value) => /^https?:\/\//i.test(value.trim());

export default function CameraScreen({ navigation, route }) {
  const [facing, setFacing] = useState('back');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const { addPage } = useScanSession();
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [showCoachMarks, setShowCoachMarks] = useState(false);

  // Standalone "Scan Barcode" (Home) launches straight into QR mode via this
  // param, instead of the normal document-capture flow.
  const startInQrMode = route.params?.startInQrMode === true;

  // 'photo' is the normal document-capture mode; 'qr' swaps in expo-camera's
  // built-in barcode detection (no extra native module needed, so this stays
  // Expo Go compatible). `scanLockRef` stops the same code from firing the
  // alert multiple times per second while the camera keeps seeing it.
  const [scanMode, setScanMode] = useState(startInQrMode ? 'qr' : 'photo');
  const scanLockRef = useRef(false);

  useEffect(() => {
    // The document-scanning coach marks don't apply when entering straight
    // into barcode mode, so they're skipped for that entry point entirely.
    if (cameraPermission?.granted && !startInQrMode) {
      hasSeenCameraCoachmarks().then((seen) => {
        if (!seen) setShowCoachMarks(true);
      });
    }
  }, [cameraPermission?.granted, startInQrMode]);

  const dismissCoachMarks = () => {
    setShowCoachMarks(false);
    markCameraCoachmarksSeen();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
    },
    permissionContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxl,
    },
    permissionIconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    permissionTitle: {
      ...typography.title,
      fontSize: RFValue(20),
      textAlign: 'center',
    },
    permissionBody: {
      ...typography.subtitle,
      textAlign: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.xl,
    },
    permissionButton: {
      width: '100%',
    },
    camera: {
      flex: 1,
    },
    TopbuttonContainer: {
      position: 'absolute',
      left: spacing.lg,
      alignItems: 'center',
    },
    topRightButtonContainer: {
      position: 'absolute',
      right: spacing.lg,
      alignItems: 'center',
    },
    qrHintWrap: {
      position: 'absolute',
      top: '18%',
      left: spacing.xxl,
      right: spacing.xxl,
      alignItems: 'center',
    },
    qrHintText: {
      ...typography.label,
      color: colors.white,
      textAlign: 'center',
      backgroundColor: 'rgba(20, 12, 20, 0.55)',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
    buttonContainer: {
      position: 'absolute',
      bottom: 0,
      left: spacing.xl,
      right: spacing.xl,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      backgroundColor: 'rgba(20, 12, 20, 0.55)',
      borderRadius: radius.pill,
      paddingVertical: spacing.md,
    },
    glassCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutterOuter: {
      width: 68,
      height: 68,
      borderRadius: 34,
      borderWidth: 3,
      borderColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutterInner: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.white,
    },
    coachOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      paddingTop: insets.top + spacing.xl,
      paddingBottom: insets.bottom + spacing.xl,
    },
    coachCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      width: '100%',
    },
    coachTitle: {
      ...typography.title,
      fontSize: RFValue(18),
      marginTop: spacing.md,
    },
    coachBody: {
      ...typography.subtitle,
      textAlign: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    coachButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.md,
      borderRadius: radius.pill,
    },
    coachButtonText: {
      ...typography.button,
      color: colors.white,
    },
  });

  if (!cameraPermission) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  if (!cameraPermission.granted) {
    return (
      <Screen>
        <Header title="Camera Access" onBack={() => resetTo(navigation, 'Home')} />
        <View style={styles.permissionContent}>
          <View style={styles.permissionIconWrap}>
            <Ionicons name="camera" size={44} color={colors.accent} />
          </View>
          <Text style={styles.permissionTitle}>Allow camera access</Text>
          <Text style={styles.permissionBody}>
            Pro Scanner needs your camera to capture documents and turn them into PDFs.
          </Text>
          <Button title="Grant Camera Permission" onPress={requestCameraPermission} style={styles.permissionButton} />
        </View>
      </Screen>
    );
  }

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const toggleScanMode = () => {
    setScanMode((current) => (current === 'photo' ? 'qr' : 'photo'));
  };

  // expo-camera keeps calling this every frame a code is visible, so the
  // lock ref stops the same code from opening a second Alert on top of the
  // first; each action resets the lock once the user has actually responded.
  const handleBarcodeScanned = ({ data }) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    const unlock = () => {
      scanLockRef.current = false;
    };

    const actions = [
      {
        text: 'Copy',
        onPress: async () => {
          await Clipboard.setStringAsync(data);
          unlock();
        },
      },
    ];
    if (isLikelyUrl(data)) {
      actions.push({
        text: 'Open Link',
        onPress: () => {
          Linking.openURL(data).catch(() => Alert.alert('Error', 'Could not open this link.'));
          unlock();
        },
      });
    }
    actions.push({ text: 'Dismiss', style: 'cancel', onPress: unlock });

    // onDismiss (Android only) covers dismissing via the hardware back
    // button or tapping outside the alert - without it, that path skips
    // every button's onPress, leaving scanLockRef stuck `true` and silently
    // preventing any further scans until the screen is left and reopened.
    Alert.alert('Code Scanned', data, actions, { onDismiss: unlock });
  };

  const goToPageEdit = (uri) => {
    const pageId = addPage(uri);
    if (!pageId) {
      Alert.alert(
        'Page Limit Reached',
        `A single document can have up to ${MAX_PAGES_PER_DOCUMENT} pages. Remove a page, or save this scan and start a new one to keep going.`
      );
      return;
    }
    navigation.navigate('PageEdit', { pageId });
  };

  const pickImageFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      goToPageEdit(result.assets[0].uri);
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
      goToPageEdit(photo.uri);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing={facing}
        ref={cameraRef}
        barcodeScannerSettings={
          scanMode === 'qr'
            ? { barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'pdf417', 'upc_a', 'upc_e'] }
            : undefined
        }
        onBarcodeScanned={scanMode === 'qr' ? handleBarcodeScanned : undefined}
      />
      <View style={[styles.TopbuttonContainer, { marginTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.glassCircle} onPress={() => resetTo(navigation, 'Home')}>
          <Ionicons name="home" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>
      <View style={[styles.topRightButtonContainer, { marginTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.glassCircle} onPress={toggleScanMode}>
          <Ionicons name={scanMode === 'qr' ? 'camera-outline' : 'qr-code-outline'} size={20} color={colors.white} />
        </TouchableOpacity>
      </View>

      {scanMode === 'qr' && (
        <View style={styles.qrHintWrap} pointerEvents="none">
          <Text style={styles.qrHintText}>Point your camera at a QR or barcode</Text>
        </View>
      )}

      <View style={[styles.buttonContainer, { marginBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={styles.glassCircle} onPress={pickImageFromGallery}>
          <Ionicons name="images" size={24} color={colors.white} />
        </TouchableOpacity>
        {scanMode === 'photo' ? (
          <TouchableOpacity style={styles.shutterOuter} onPress={takePicture} activeOpacity={0.7}>
            <View style={styles.shutterInner} />
          </TouchableOpacity>
        ) : (
          <View style={styles.shutterOuter}>
            <Ionicons name="qr-code" size={28} color={colors.white} />
          </View>
        )}
        <TouchableOpacity style={styles.glassCircle} onPress={toggleCameraFacing}>
          <Ionicons name="camera-reverse" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      {showCoachMarks && (
        <TouchableOpacity style={styles.coachOverlay} activeOpacity={1} onPress={dismissCoachMarks}>
          <View style={styles.coachCard}>
            <Ionicons name="camera" size={28} color={colors.accent} />
            <Text style={styles.coachTitle}>Ready to scan</Text>
            <Text style={styles.coachBody}>
              Tap the shutter to capture a page, pick one from your gallery, or flip the camera - all from the
              buttons below.
            </Text>
            <TouchableOpacity style={styles.coachButton} onPress={dismissCoachMarks}>
              <Text style={styles.coachButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}
