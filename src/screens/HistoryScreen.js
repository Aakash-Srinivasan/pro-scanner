import React, { useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RFValue } from 'react-native-responsive-fontsize';
import Screen from '../components/Screen';
import Header from '../components/Header';
import { useHistory } from '../context/HistoryContext';
import { useScanSession } from '../context/ScanSessionContext';
import { groupHistoryByDate } from '../utils/historyGroups';
import { buildPdfFromPages } from '../utils/buildPdf';
import { generateScanName } from '../utils/scanName';
import { MAX_PAGES_PER_DOCUMENT } from '../utils/scanLimits';
import { useTheme } from '../context/ThemeContext';

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Flattens grouped sections into a single list of "header" and "row" entries
// (2 per row in grid mode, 1 per row in list mode), so one FlatList can
// render section titles while switching layouts within each section.
function buildListItems(history, viewMode) {
  const sections = groupHistoryByDate(history);
  const perRow = viewMode === 'grid' ? 2 : 1;
  const items = [];
  sections.forEach((section) => {
    items.push({
      type: 'header',
      key: `header-${section.title}`,
      title: `${section.title} (${section.data.length})`,
    });
    for (let i = 0; i < section.data.length; i += perRow) {
      const pair = section.data.slice(i, i + perRow);
      items.push({ type: 'row', key: `row-${section.title}-${i}`, entries: pair });
    }
  });
  return items;
}

export default function HistoryScreen({ navigation }) {
  const { history, addEntry, removeEntry } = useHistory();
  const { pages: activeSessionPages, loadPages } = useScanSession();
  const { colors, spacing, radius, typography, shadow } = useTheme();
  const [viewMode, setViewMode] = useState('grid');
  const [query, setQuery] = useState('');

  // Merge mode: `selectedIds` preserves the order entries were tapped in
  // (not list order), so the user controls the resulting page order simply
  // by the order they select scans in.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [merging, setMerging] = useState(false);

  const filteredHistory = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter((entry) => entry.name.toLowerCase().includes(q));
  }, [history, query]);

  const listItems = useMemo(() => buildListItems(filteredHistory, viewMode), [filteredHistory, viewMode]);

  const openEntry = async (entry) => {
    try {
      const pdfBytes = await FileSystem.readAsStringAsync(entry.pdfUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      navigation.navigate('Preview', {
        pdfBytes,
        pageThumbnails: entry.pageUris,
        suggestedName: entry.name,
      });
    } catch (error) {
      console.error('Error opening history entry:', error);
      Alert.alert('Error', 'This scan could not be opened.');
    }
  };

  const confirmDelete = (entry) => {
    Alert.alert('Delete Scan', `Delete "${entry.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeEntry(entry.id) },
    ]);
  };

  // Reopens a saved scan's pages in the same add/reorder/delete editor used
  // for a fresh scan; "Done" there will overwrite this entry (see
  // ScanSessionContext's `sourceEntryId` / PagesScreen's handleDone).
  const editEntry = (entry) => {
    const startEditing = () => {
      loadPages(entry.pageUris, entry.id);
      navigation.navigate('Pages');
    };

    if (activeSessionPages.length > 0) {
      Alert.alert(
        'Discard Current Scan?',
        'You have an unfinished scan in progress. Editing this saved scan will replace it.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', style: 'destructive', onPress: startEditing },
        ]
      );
      return;
    }
    startEditing();
  };

  const toggleSelectMode = () => {
    setSelectMode((prev) => !prev);
    setSelectedIds([]);
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]));
  };

  const handleEntryPress = (entry) => {
    if (selectMode) {
      toggleSelected(entry.id);
    } else {
      openEntry(entry);
    }
  };

  // Combines every page from the selected scans (in tap order) into one new
  // PDF via the same page-building pipeline used for a fresh scan, then
  // saves it as its own History entry so the originals are left untouched.
  const handleMerge = async () => {
    if (selectedIds.length < 2) return;
    setMerging(true);
    try {
      const orderedEntries = selectedIds.map((id) => history.find((entry) => entry.id === id)).filter(Boolean);
      const mergedPageUris = orderedEntries.flatMap((entry) => entry.pageUris);

      if (mergedPageUris.length > MAX_PAGES_PER_DOCUMENT) {
        Alert.alert(
          'Too Many Pages to Merge',
          `The selected scans add up to ${mergedPageUris.length} pages, but a single document can have up to ${MAX_PAGES_PER_DOCUMENT}. Select fewer scans and try again.`
        );
        return;
      }

      const pdfBytes = await buildPdfFromPages(mergedPageUris.map((uri) => ({ uri })));

      const tempPdfUri = `${FileSystem.cacheDirectory}temp-merge-${Date.now()}.pdf`;
      await FileSystem.writeAsStringAsync(tempPdfUri, pdfBytes, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const mergedName = generateScanName(new Date(), 'Merged');
      const entry = await addEntry({ name: mergedName, pdfUri: tempPdfUri, pageUris: mergedPageUris });

      // addEntry already copied this into permanent History storage - the
      // cache copy is now redundant. (mergedPageUris are the *source*
      // entries' own permanent files and must not be touched here.)
      FileSystem.deleteAsync(tempPdfUri, { idempotent: true }).catch(() => {});

      setSelectMode(false);
      setSelectedIds([]);
      navigation.navigate('Preview', {
        pdfBytes,
        pageThumbnails: entry.pageUris,
        suggestedName: mergedName,
      });
    } catch (error) {
      console.error('Error merging scans:', error);
      Alert.alert('Error', 'Failed to merge the selected scans.');
    } finally {
      setMerging(false);
    }
  };

  const renderGridCard = (entry) => {
    const isSelected = selectedIds.includes(entry.id);
    return (
      <TouchableOpacity
        key={entry.id}
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => handleEntryPress(entry)}
        activeOpacity={0.8}
      >
        <Image source={{ uri: entry.pageUris[0] }} style={styles.thumbnail} resizeMode="cover" />
        <Text style={styles.cardTitle} numberOfLines={1}>{entry.name}.pdf</Text>
        <Text style={styles.cardMeta}>
          {formatTime(entry.createdAt)} · {entry.pageCount} page{entry.pageCount === 1 ? '' : 's'}
        </Text>
        {selectMode ? (
          <View style={[styles.selectBadge, isSelected && styles.selectBadgeActive]}>
            {isSelected && <Ionicons name="checkmark" size={14} color={colors.white} />}
          </View>
        ) : (
          <>
            <TouchableOpacity style={styles.editButton} onPress={() => editEntry(entry)}>
              <Ionicons name="create-outline" size={18} color={colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={() => confirmDelete(entry)}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
          </>
        )}
      </TouchableOpacity>
    );
  };

  const renderListRow = (entry) => {
    const isSelected = selectedIds.includes(entry.id);
    return (
      <TouchableOpacity
        key={entry.id}
        style={[styles.listRow, isSelected && styles.cardSelected]}
        onPress={() => handleEntryPress(entry)}
        activeOpacity={0.8}
      >
        <Image source={{ uri: entry.pageUris[0] }} style={styles.listThumbnail} resizeMode="cover" />
        <View style={styles.listInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{entry.name}.pdf</Text>
          <Text style={styles.cardMeta}>
            {formatTime(entry.createdAt)} · {entry.pageCount} page{entry.pageCount === 1 ? '' : 's'}
          </Text>
        </View>
        {selectMode ? (
          <View style={[styles.selectBadge, isSelected && styles.selectBadgeActive]}>
            {isSelected && <Ionicons name="checkmark" size={14} color={colors.white} />}
          </View>
        ) : (
          <View style={styles.listRowActions}>
            <TouchableOpacity onPress={() => editEntry(entry)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="create-outline" size={20} color={colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => confirmDelete(entry)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const styles = StyleSheet.create({
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      padding: 0,
      ...typography.body,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxl,
    },
    emptyTitle: {
      ...typography.title,
      fontSize: RFValue(18),
      marginTop: spacing.lg,
    },
    emptyBody: {
      ...typography.subtitle,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    listContent: {
      padding: spacing.lg,
    },
    sectionHeader: {
      ...typography.title,
      fontSize: RFValue(16),
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    cardSpacer: {
      flex: 1,
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
    cardTitle: {
      ...typography.label,
      color: colors.text,
      marginTop: spacing.sm,
    },
    cardMeta: {
      ...typography.label,
      color: colors.textMuted,
      fontFamily: 'Nunito-Regular',
      marginTop: 2,
    },
    deleteButton: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      padding: spacing.xs,
      ...shadow,
    },
    editButton: {
      position: 'absolute',
      top: spacing.sm,
      left: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      padding: spacing.xs,
      ...shadow,
    },
    listRowActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    cardSelected: {
      borderWidth: 2,
      borderColor: colors.accent,
    },
    selectBadge: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.accent,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectBadgeActive: {
      backgroundColor: colors.accent,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginBottom: spacing.md,
      ...shadow,
    },
    listThumbnail: {
      width: 56,
      height: 56,
      borderRadius: radius.sm,
      backgroundColor: colors.border,
    },
    listInfo: {
      flex: 1,
      marginLeft: spacing.md,
      marginRight: spacing.sm,
    },
    mergeBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.lg,
      ...shadow,
    },
    mergeBarText: {
      ...typography.label,
      color: colors.text,
      flex: 1,
      marginRight: spacing.md,
    },
    mergeButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      minWidth: 84,
      alignItems: 'center',
    },
    mergeButtonDisabled: {
      opacity: 0.4,
    },
    mergeButtonText: {
      ...typography.button,
      color: colors.white,
    },
  });

  return (
    <Screen>
      <Header
        title={selectMode ? `${selectedIds.length} selected` : `History (${history.length})`}
        onBack={selectMode ? toggleSelectMode : () => navigation.goBack()}
        right={
          <View style={styles.headerActions}>
            {!selectMode && (
              <TouchableOpacity
                onPress={() => setViewMode((m) => (m === 'grid' ? 'list' : 'grid'))}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'} size={22} color={colors.text} />
              </TouchableOpacity>
            )}
            {!selectMode && history.length >= 2 && (
              <TouchableOpacity onPress={toggleSelectMode} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="checkbox-outline" size={22} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {history.length > 0 && (
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name"
            placeholderTextColor={colors.textMuted}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {history.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={56} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No scans yet</Text>
          <Text style={styles.emptyBody}>Documents you scan will show up here.</Text>
        </View>
      ) : filteredHistory.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={56} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No matches</Text>
          <Text style={styles.emptyBody}>No scans match "{query}".</Text>
        </View>
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={styles.sectionHeader}>{item.title}</Text>;
            }
            if (viewMode === 'list') {
              return <View>{item.entries.map(renderListRow)}</View>;
            }
            return (
              <View style={styles.row}>
                {item.entries.map(renderGridCard)}
                {item.entries.length === 1 && <View style={styles.cardSpacer} />}
              </View>
            );
          }}
        />
      )}

      {selectMode && (
        <View style={styles.mergeBar}>
          <Text style={styles.mergeBarText}>
            {selectedIds.length < 2
              ? 'Select 2 or more scans to merge'
              : `${selectedIds.length} scans selected`}
          </Text>
          <TouchableOpacity
            style={[styles.mergeButton, selectedIds.length < 2 && styles.mergeButtonDisabled]}
            onPress={handleMerge}
            disabled={selectedIds.length < 2 || merging}
          >
            {merging ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.mergeButtonText}>Merge</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </Screen>
  );
}
