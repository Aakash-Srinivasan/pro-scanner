import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, ScrollView } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RFValue } from 'react-native-responsive-fontsize';
import Screen from '../components/Screen';
import Header from '../components/Header';
import { useHistory } from '../context/HistoryContext';
import { pickFile } from '../utils/pickFile';
import { createHistoryBackup, readHistoryBackup } from '../utils/historyBackup';
import { formatBytes, estimateBase64Size } from '../utils/fileSize';
import { useTheme } from '../context/ThemeContext';

const ANDROID_DOWNLOADS_URI = 'content://com.android.externalstorage.documents/document/primary:Download';

function backupFileName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `ProScannerBackup_${stamp}.zip`;
}

export default function BackupRestoreScreen({ navigation }) {
  const { colors, spacing, radius, typography, shadow } = useTheme();
  const { history, addEntry } = useHistory();
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleBackup = async () => {
    if (history.length === 0) {
      Alert.alert('No Scans Yet', 'Scan at least one document first - there\'s nothing to back up yet.');
      return;
    }
    setBackingUp(true);
    let zipUri = null;
    try {
      const zipBase64 = await createHistoryBackup(history);
      const fileName = backupFileName();
      zipUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(zipUri, zipBase64, {
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
            'application/zip'
          );
          await FileSystem.writeAsStringAsync(destUri, zipBase64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          Alert.alert('Backup Saved', `${fileName} (${formatBytes(estimateBase64Size(zipBase64))}) was saved to your chosen folder.`);
          return;
        }
      }

      await Sharing.shareAsync(zipUri, { mimeType: 'application/zip', dialogTitle: 'Save Backup' });
    } catch (error) {
      console.error('Error creating backup:', error);
      Alert.alert('Error', 'Could not create the backup. Please try again.');
    } finally {
      // The cache copy is only ever needed transiently, to hand off to SAF
      // or the share sheet above - safe to clean up either way it exits.
      if (zipUri) {
        FileSystem.deleteAsync(zipUri, { idempotent: true }).catch(() => {});
      }
      setBackingUp(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const picked = await pickFile({ mimeType: 'application/zip', extension: 'zip', cachePrefix: 'restore-input' });
      if (!picked) {
        setRestoring(false);
        return;
      }

      const restoredItems = await readHistoryBackup(picked.uri, 'restore');
      if (restoredItems.length === 0) {
        Alert.alert('Empty Backup', 'This backup file has no scans in it.');
        return;
      }

      // Each restored scan is added as its own new History entry (with a
      // freshly generated id) rather than trying to overwrite anything, so
      // restoring never deletes what's already on this device - re-restoring
      // the same backup twice will create duplicates, which is the simple,
      // safe tradeoff for not needing to build entry-matching/merge logic.
      for (const item of restoredItems) {
        await addEntry({
          name: item.name,
          pdfUri: item.pdfUri,
          pageUris: item.pageUris,
          createdAt: item.createdAt,
        });
        // addEntry already copied these extracted files into permanent
        // History storage - the cache copies are now redundant.
        FileSystem.deleteAsync(item.pdfUri, { idempotent: true }).catch(() => {});
        item.pageUris.forEach((uri) => {
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        });
      }
      FileSystem.deleteAsync(picked.uri, { idempotent: true }).catch(() => {});

      Alert.alert('Restored', `${restoredItems.length} scan${restoredItems.length === 1 ? '' : 's'} restored to your History.`, [
        { text: 'View History', onPress: () => navigation.navigate('History') },
        { text: 'OK', style: 'cancel' },
      ]);
    } catch (error) {
      console.error('Error restoring backup:', error);
      Alert.alert('Error', error.message || 'Could not restore this backup file.');
    } finally {
      setRestoring(false);
    }
  };

  const styles = StyleSheet.create({
    scrollView: {
      flex: 1,
    },
    content: {
      padding: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      marginBottom: spacing.xl,
      ...shadow,
    },
    cardIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    cardTitle: {
      ...typography.title,
      fontSize: RFValue(18),
    },
    cardBody: {
      ...typography.subtitle,
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
    },
    actionButton: {
      backgroundColor: colors.accent,
      borderRadius: radius.pill,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    actionButtonText: {
      ...typography.button,
      color: colors.white,
      fontSize: RFValue(16),
    },
    tipCard: {
      flexDirection: 'row',
      gap: spacing.sm,
      backgroundColor: colors.accentSoft,
      borderRadius: radius.md,
      padding: spacing.md,
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
      <Header title="Backup & Restore" subtitle="Keep your History safe, or bring it back" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="cloud-upload-outline" size={26} color={colors.accent} />
          </View>
          <Text style={styles.cardTitle}>Back Up History</Text>
          <Text style={styles.cardBody}>
            Bundles all {history.length} saved scan{history.length === 1 ? '' : 's'} into a single file you can save
            anywhere - a cloud drive, an email to yourself, another device.
          </Text>
          <TouchableOpacity style={styles.actionButton} onPress={handleBackup} disabled={backingUp}>
            {backingUp ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.actionButtonText}>Create Backup</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="cloud-download-outline" size={26} color={colors.accent} />
          </View>
          <Text style={styles.cardTitle}>Restore from Backup</Text>
          <Text style={styles.cardBody}>
            Pick a backup file created by Pro Scanner to add those scans back into your History.
          </Text>
          <TouchableOpacity style={styles.actionButton} onPress={handleRestore} disabled={restoring}>
            {restoring ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.actionButtonText}>Choose Backup File</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={18} color={colors.accent} />
          <Text style={styles.tipText}>
            Restoring adds scans alongside what's already in your History - it never deletes anything. Restoring the
            same backup twice will add duplicates.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
