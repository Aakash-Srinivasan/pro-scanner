import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, FlatList, useWindowDimensions } from 'react-native';
import { RFValue } from 'react-native-responsive-fontsize';
import Screen from '../components/Screen';
import Button from '../components/Button';
import { useScanSession } from '../context/ScanSessionContext';
import { markOnboardingComplete } from '../utils/onboarding';
import { resetTo } from '../utils/navigation';
import { colors, spacing, radius, typography } from '../theme';

const AUTO_ADVANCE_INTERVAL = 3500;
const SLIDE_HORIZONTAL_PADDING = spacing.xl * 2;

const SLIDES = [
  {
    key: 'slide1',
    image: require('../../assets/images/slide1.png'),
    lines: ['Scan all your Documents', 'easily convert into PDF quickly'],
  },
  {
    key: 'slide3',
    image: require('../../assets/images/slide3.png'),
    aspectRatio: 1280 / 960,
    width: 300,
    lines: ['Download it', 'and Share it'],
  },
  {
    key: 'slide4',
    image: require('../../assets/images/slide-history.png'),
    lines: ['Access your Scan History', 'anytime, anywhere'],
  },
  {
    key: 'slide5',
    image: require('../../assets/images/slide-privacy.png'),
    lines: ['No login, no data stored', 'Just scan, export, and you’re done'],
  },
];

export default function OnboardingScreen({ navigation }) {
  const { clearSession } = useScanSession();
  const listRef = useRef(null);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);
  // Reactive (not a one-time Dimensions.get() snapshot) so rotating the
  // device or resizing a split-screen/foldable window keeps each slide and
  // its paging math lined up with the actual current width.
  const { width: screenWidth } = useWindowDimensions();

  const goToCamera = useCallback(() => {
    markOnboardingComplete();
    clearSession();
    // Reset (not navigate) so Intro/Onboarding never reappear via the
    // hardware back button once the user has moved into the app proper.
    resetTo(navigation, 'Camera');
  }, [clearSession, navigation]);

  const scrollToIndex = useCallback((next) => {
    indexRef.current = next;
    setIndex(next);
    listRef.current?.scrollToIndex({ index: next, animated: true });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      scrollToIndex((indexRef.current + 1) % SLIDES.length);
    }, AUTO_ADVANCE_INTERVAL);
    return () => clearInterval(timer);
  }, [scrollToIndex]);

  const onMomentumScrollEnd = (event) => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    indexRef.current = newIndex;
    setIndex(newIndex);
  };

  const handleNext = () => {
    if (index === SLIDES.length - 1) {
      goToCamera();
    } else {
      scrollToIndex(index + 1);
    }
  };

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
      </View>

      <View style={styles.content}>
        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          getItemLayout={(_, i) => ({ length: screenWidth, offset: screenWidth * i, index: i })}
          renderItem={({ item }) => {
            // Slides with a custom width (e.g. slide3's wider 4:3 image) still
            // get clamped to the available width, so they can't overflow past
            // the screen edges on narrow phones.
            const customWidth = item.width
              ? Math.min(item.width, screenWidth - SLIDE_HORIZONTAL_PADDING)
              : undefined;
            return (
              <View style={[styles.slide, { width: screenWidth }]}>
                <Image
                  source={item.image}
                  style={[
                    styles.logo,
                    item.aspectRatio && {
                      height: undefined,
                      aspectRatio: item.aspectRatio,
                      width: customWidth || styles.logo.width,
                    },
                  ]}
                  resizeMode="contain"
                />
                <View style={styles.quotescontainer}>
                  {item.lines.map((line) => (
                    <Text key={line} style={styles.quotes}>
                      {line}
                    </Text>
                  ))}
                </View>
              </View>
            );
          }}
        />

        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <View key={slide.key} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.buttonContainer}>
          <Button title="Skip" variant="secondary" onPress={goToCamera} style={styles.actionButton} />
          <Button
            title={index === SLIDES.length - 1 ? 'Get Started' : 'Next'}
            onPress={handleNext}
            style={styles.actionButton}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
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
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 240,
    height: 240,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  quotescontainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  quotes: {
    ...typography.body,
    fontFamily: 'Nunito-Bold',
    fontSize: RFValue(20),
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xxl,
    marginBottom: spacing.xxl,
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});
