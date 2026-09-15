import React, { useEffect, useMemo, useRef } from 'react';
import { Text, StyleSheet, TouchableOpacity, View, Image, FlatList, Alert, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RFValue } from 'react-native-responsive-fontsize';
import Screen from '../components/Screen';
import { useScanSession } from '../context/ScanSessionContext';
import { useHistory } from '../context/HistoryContext';
import { formatShortDate } from '../utils/historyGroups';
import { colors, spacing, radius, typography, shadow } from '../theme';

const RECENT_COUNT = 4;

// Quick-action tiles shown on Home so every top-level feature has a visible,
// one-tap entry point instead of being buried inside another screen's flow.
// `onPress` is resolved per-item in the component body (it needs `navigation`
// and session state), so this only holds the static, presentational parts.
// The single 'primary' tile is featured full-width; everything else renders
// as an equal-width card in the row below it.
const PRIMARY_ACTION = {
  key: 'scan',
  icon: 'camera',
  title: 'Scan Document',
  getSubtitle: () => 'Capture a new page',
};

const SECONDARY_ACTIONS = [
  {
    key: 'history',
    icon: 'time',
    title: 'History',
    getSubtitle: (count) => `${count} saved scan${count === 1 ? '' : 's'}`,
  },
  {
    key: 'compress',
    icon: 'contract-outline',
    title: 'Compress PDF',
    getSubtitle: () => 'Shrink any PDF file',
  },
  {
    key: 'sign',
    icon: 'create-outline',
    title: 'Sign PDF',
    getSubtitle: () => 'Stamp your signature',
  },
  {
    key: 'barcode',
    icon: 'qr-code-outline',
    title: 'Scan Barcode',
    getSubtitle: () => 'QR codes & barcodes',
  },
];

// Splits the secondary actions into rows of 2 so cards stay comfortably
// sized regardless of how many secondary actions there are.
function chunkPairs(items) {
  const rows = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

export default function HomeScreen({ navigation }) {
  const { pages, restored, clearSession } = useScanSession();
  const { history } = useHistory();
  const promptedRef = useRef(false);

  // If the app was backgrounded or killed mid-scan, ScanSessionContext
  // restores those pages from disk on launch - surface that here (Home is
  // the one screen every "return to the app" path passes through) rather
  // than silently discarding photos the user already took.
  useEffect(() => {
    if (!restored || pages.length === 0 || promptedRef.current) return;
    promptedRef.current = true;
    Alert.alert(
      'Resume Unfinished Scan?',
      `You have ${pages.length} page${pages.length === 1 ? '' : 's'} from a scan that wasn't finished.`,
      [
        { text: 'Discard', style: 'destructive', onPress: () => clearSession() },
        { text: 'Resume', onPress: () => navigation.navigate('Pages') },
      ]
    );
  }, [restored, pages.length, clearSession, navigation]);

  const startScan = () => {
    clearSession();
    navigation.navigate('Camera');
  };

  const goToHistory = () => navigation.navigate('History');

  const handleQuickAction = (key) => {
    if (key === 'scan') startScan();
    else if (key === 'history') goToHistory();
    else if (key === 'compress') navigation.navigate('PdfCompressor');
    else if (key === 'sign') navigation.navigate('SignPdf');
    else if (key === 'barcode') navigation.navigate('Camera', { startInQrMode: true });
  };

  const secondaryRows = useMemo(() => chunkPairs(SECONDARY_ACTIONS), []);

  // Slicing a small, already-sorted array on every render is cheap, but
  // memoizing keeps this screen's re-render cost tied only to what actually
  // changed (the history list), not every unrelated state update.
  const recent = useMemo(() => history.slice(0, RECENT_COUNT), [history]);

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image source={require('../../assets/images/Prologo.png')} style={styles.brandIcon} resizeMode="contain" />
          <View>
            <Text style={styles.title}>Pro Scanner</Text>
            <Text style={styles.subtitle}>Digitize your Docs</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Guide')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="information-circle-outline" size={26} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scrollView}>
        <>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickCard, styles.quickCardPrimary]}
              activeOpacity={0.85}
              onPress={() => handleQuickAction(PRIMARY_ACTION.key)}
            >
              {/* Purely decorative brand watermark - bleeds off the card's own
              edge, clipped by its rounded corner via overflow:'hidden' below.
              pointerEvents="none" keeps it from stealing the card's tap. */}
              <Image
                source={require('../../assets/images/Prologo.png')}
                style={styles.quickCardWatermark}
                resizeMode="contain"
                pointerEvents="none"
              />
              <View style={[styles.quickIconWrap, styles.quickIconWrapPrimary]}>
                <Ionicons name={PRIMARY_ACTION.icon} size={22} color={colors.white} />
              </View>
              <Text style={[styles.quickTitle, styles.quickTitleOnAccent]}>{PRIMARY_ACTION.title}</Text>
              <Text style={[styles.quickSubtitle, styles.quickSubtitleOnAccent]}>
                {PRIMARY_ACTION.getSubtitle(history.length)}
              </Text>
            </TouchableOpacity>

            {secondaryRows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.secondaryRow}>
                {row.map((action) => (
                  <TouchableOpacity
                    key={action.key}
                    style={[styles.quickCard, styles.quickCardSecondary]}
                    activeOpacity={0.85}
                    onPress={() => handleQuickAction(action.key)}
                  >
                    <Image
                      source={require('../../assets/images/Prologo.png')}
                      style={styles.quickCardWatermarkSmall}
                      resizeMode="contain"
                      pointerEvents="none"
                    />
                    <View style={styles.quickIconWrap}>
                      <Ionicons name={action.icon} size={20} color={colors.accent} />
                    </View>
                    <Text style={styles.quickTitle}>{action.title}</Text>
                    <Text style={styles.quickSubtitle}>{action.getSubtitle(history.length)}</Text>
                  </TouchableOpacity>
                ))}
                {row.length === 1 && <View style={styles.quickCardSpacer} />}
              </View>
            ))}
          </View>

          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>Recent</Text>
              {history.length > 0 && (
                <TouchableOpacity onPress={goToHistory}>
                  <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
              )}
            </View>

            {recent.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={40} color={colors.border} />
                <Text style={styles.emptyText}>Your scanned documents will appear here</Text>
              </View>
            ) : (
              <FlatList
                data={recent}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentList}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.recentCard} activeOpacity={0.8} onPress={goToHistory}>
                    <Image source={{ uri: item.pageUris[0] }} style={styles.recentThumbnail} resizeMode="cover" />
                    <Text style={styles.recentLabel} numberOfLines={1}>{item.name}.pdf</Text>
                    <Text style={styles.recentDate}>{formatShortDate(item.createdAt)}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandIcon: {
    width: 30,
    height: 30,
  },
  title: {
    ...typography.title,
    fontSize: RFValue(20),
  },
  subtitle: {
    ...typography.subtitle,
    fontSize: RFValue(13),
    marginTop: 1,
  },
  quickActions: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickCardSpacer: {
    flex: 1,
  },
  quickCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  quickCardPrimary: {
    backgroundColor: colors.accent,
    overflow: 'hidden',
    ...shadow,
  },
  quickCardWatermark: {
    position: 'absolute',
    top: -20,
    right: -30,
    width: 160,
    height: 160,
    opacity: 0.18,
    tintColor: colors.white,
  },
  quickCardWatermarkSmall: {
    position: 'absolute',
    top: -14,
    right: -18,
    width: 90,
    height: 90,
    opacity: 0.14,
    tintColor: colors.accent,
  },
  quickCardSecondary: {
    // Only the secondary cards need flex:1 - they're the ones sharing a
    // row and need to divide its width evenly. The primary card is a
    // column's sole child, where flex:1 (flexBasis: 0%) would instead
    // collapse its height to nothing since the column has no extra space
    // to grow into.
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  quickIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  quickIconWrapPrimary: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  quickTitle: {
    ...typography.button,
    fontSize: RFValue(14),
    color: colors.text,
  },
  quickTitleOnAccent: {
    color: colors.white,
  },
  quickSubtitle: {
    ...typography.label,
    fontFamily: 'Nunito-Regular',
    color: colors.textMuted,
    fontSize: RFValue(11),
    marginTop: 2,
  },
  quickSubtitleOnAccent: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  recentSection: {
    marginTop: spacing.xxl,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  recentTitle: {
    ...typography.title,
    fontSize: RFValue(16),
  },
  seeAll: {
    ...typography.label,
    color: colors.accent,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xxl,
  },
  emptyText: {
    ...typography.subtitle,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  recentList: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.md,
    // Explicit (not relying on the row default of 'stretch'): each card
    // sizes to its own content and never stretches to match the list's
    // container height.
    alignItems: 'flex-start',
  },
  recentCard: {
    width: 110,
    marginRight: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xs,
    ...shadow,
  },
  recentThumbnail: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },
  recentLabel: {
    ...typography.label,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  recentDate: {
    ...typography.label,
    fontFamily: 'Nunito-Regular',
    color: colors.textMuted,
    fontSize: RFValue(11),
    textAlign: 'center',
  },
});
