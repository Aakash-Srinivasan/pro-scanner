import React, { useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RFValue } from 'react-native-responsive-fontsize';
import * as FileSystem from 'expo-file-system/legacy';
import Screen from '../components/Screen';
import Header from '../components/Header';
import Button from '../components/Button';
import { useScanSession } from '../context/ScanSessionContext';
import { useHistory } from '../context/HistoryContext';
import { buildPdfFromPages } from '../utils/buildPdf';
import { generateScanName } from '../utils/scanName';
import { MAX_PAGES_PER_DOCUMENT } from '../utils/scanLimits';
import { useTheme } from '../context/ThemeContext';

export default function PagesScreen({ navigation }) {
  const { pages, sourceEntryId, removePage, reorderPages } = useScanSession();
  const { history, addEntry, updateEntry } = useHistory();
  const { colors, spacing, radius, typography, shadow } = useTheme();
  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(null);
  const nameInputRef = useRef(null);

  // Editing an already-saved scan starts from its existing name; a fresh
  // scan gets an auto-generated one, same as before - both are editable
  // right here now instead of only later on the Preview screen. The default
  // is remembered so a cleared name can snap back to it (see
  // finishEditingName below) rather than being silently caught only at save.
  const defaultNameRef = useRef(null);
  const [fileName, setFileName] = useState(() => {
    const existing = sourceEntryId ? history.find((entry) => entry.id === sourceEntryId) : null;
    const initial = existing?.name || generateScanName();
    defaultNameRef.current = initial;
    return initial;
  });
  const [editingName, setEditingName] = useState(false);

  const finishEditingName = () => {
    setEditingName(false);
    if (!fileName.trim()) {
      setFileName(defaultNameRef.current || generateScanName());
    }
  };

  const handleAddPage = () => {
    if (pages.length >= MAX_PAGES_PER_DOCUMENT) {
      Alert.alert(
        'Page Limit Reached',
        `A single document can have up to ${MAX_PAGES_PER_DOCUMENT} pages. Remove a page, or save this scan and start a new one to keep going.`
      );
      return;
    }
    navigation.navigate('Camera');
  };

  const handleRetake = (pageId) => {
    navigation.navigate('PageEdit', { pageId });
  };

  const handleRemove = (pageId) => {
    if (pages.length === 1) {
      Alert.alert('Last Page', 'A document needs at least one page. Delete it from the Camera screen instead if you want to start over.');
      return;
    }
    removePage(pageId);
  };

  const handleMove = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= pages.length) return;
    reorderPages(index, target);
  };

  const handleDone = async () => {
    if (pages.length === 0) return;
    setBuilding(true);
    try {
      const pdfBytes = await buildPdfFromPages(pages, (current, total) => {
        // Only surface progress once there are enough pages for a single
        // "Building..." spinner to risk feeling stuck.
        if (total > 3) setBuildProgress({ current, total });
      });

      // Stash the freshly built PDF in cache just long enough to hand a
      // real file off to history's own permanent storage.
      const tempPdfUri = `${FileSystem.cacheDirectory}temp-${Date.now()}.pdf`;
      await FileSystem.writeAsStringAsync(tempPdfUri, pdfBytes, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const pageUris = pages.map((page) => page.processedUri || page.uri);
      const name = fileName.trim() || generateScanName();

      // Editing an already-saved scan overwrites that same History entry
      // instead of creating a duplicate alongside it.
      const entry = sourceEntryId
        ? await updateEntry(sourceEntryId, { pdfUri: tempPdfUri, pageUris, name })
        : await addEntry({ name, pdfUri: tempPdfUri, pageUris });

      // addEntry/updateEntry already copied this into permanent History
      // storage - the cache copy is now redundant.
      FileSystem.deleteAsync(tempPdfUri, { idempotent: true }).catch(() => {});

      navigation.navigate('Preview', {
        pdfBytes,
        pageThumbnails: entry.pageUris,
        suggestedName: entry.name,
      });
    } catch (error) {
      console.error('Error building PDF:', error);
      Alert.alert('Error', 'Failed to build the PDF. Please try again.');
    } finally {
      setBuilding(false);
      setBuildProgress(null);
    }
  };

  const styles = StyleSheet.create({
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      maxWidth: '100%',
    },
    titleText: {
      ...typography.title,
      fontSize: RFValue(16),
      flexShrink: 1,
    },
    titleInput: {
      ...typography.title,
      fontSize: RFValue(16),
      minWidth: 120,
      maxWidth: 180,
      padding: 0,
    },
    listContent: {
      padding: spacing.lg,
    },
    row: {
      gap: spacing.md,
    },
    card: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginBottom: spacing.md,
      ...shadow,
    },
    thumbnail: {
      width: '100%',
      aspectRatio: 3 / 4,
      borderRadius: radius.sm,
      backgroundColor: colors.border,
    },
    pageBadge: {
      position: 'absolute',
      top: spacing.md,
      left: spacing.md,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
    },
    pageBadgeText: {
      ...typography.label,
      color: colors.white,
      fontSize: RFValue(11),
    },
    deleteButton: {
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
    cardActions: {
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
      gap: spacing.md,
    },
    actionButton: {
      flex: 1,
    },
  });

  const renderItem = ({ item, index }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.processedUri || item.uri }} style={styles.thumbnail} resizeMode="cover" />

      <View style={styles.pageBadge}>
        <Text style={styles.pageBadgeText}>{index + 1}</Text>
      </View>

      <TouchableOpacity style={styles.deleteButton} onPress={() => handleRemove(item.id)}>
        <Ionicons name="trash-outline" size={16} color={colors.danger} />
      </TouchableOpacity>

      <View style={styles.cardActions}>
        <TouchableOpacity onPress={() => handleMove(index, -1)} disabled={index === 0}>
          <Ionicons name="chevron-up-circle-outline" size={22} color={index === 0 ? colors.border : colors.accent} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleMove(index, 1)} disabled={index === pages.length - 1}>
          <Ionicons
            name="chevron-down-circle-outline"
            size={22}
            color={index === pages.length - 1 ? colors.border : colors.accent}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleRetake(item.id)}>
          <Ionicons name="refresh-circle-outline" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Screen>
      <Header
        subtitle={`${pages.length} page${pages.length === 1 ? '' : 's'}`}
        onBack={() => navigation.goBack()}
        titleContent={
          <View style={styles.titleRow}>
            {editingName ? (
              <TextInput
                ref={nameInputRef}
                style={styles.titleInput}
                value={fileName}
                onChangeText={setFileName}
                placeholder="Enter file name"
                placeholderTextColor={colors.textMuted}
                autoFocus
                selectTextOnFocus
                onSubmitEditing={finishEditingName}
                onBlur={finishEditingName}
                returnKeyType="done"
              />
            ) : (
              <Text style={styles.titleText} numberOfLines={1}>{fileName}</Text>
            )}
            <TouchableOpacity
              onPress={() => (editingName ? finishEditingName() : setEditingName(true))}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={editingName ? 'checkmark' : 'pencil'}
                size={15}
                color={editingName ? colors.accent : colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        }
      />

      <FlatList
        data={pages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.actions}>
        <Button
          title="Add Page"
          variant="secondary"
          onPress={handleAddPage}
          disabled={pages.length >= MAX_PAGES_PER_DOCUMENT}
          style={styles.actionButton}
        />
        <Button
          title={
            building
              ? buildProgress
                ? `Building ${buildProgress.current}/${buildProgress.total}...`
                : 'Building...'
              : 'Done'
          }
          onPress={handleDone}
          disabled={building}
          loading={building}
          style={styles.actionButton}
        />
      </View>
    </Screen>
  );
}
