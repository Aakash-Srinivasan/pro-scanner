import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import Screen from '../components/Screen';
import { hasCompletedOnboarding } from '../utils/onboarding';
import { resetTo } from '../utils/navigation';
import { colors, spacing, typography } from '../theme';

// Read from app.json rather than hardcoded, same as the About section in
// Help & Guide, so the two can never drift out of sync with each other.
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

const Intro = ({ navigation }) => {
  useEffect(() => {
    const timer = setTimeout(async () => {
      const onboarded = await hasCompletedOnboarding();
      // Reset (not navigate) so the splash never lingers in history - the
      // hardware back button would otherwise unwind straight back into it.
      resetTo(navigation, onboarded ? 'Home' : 'Onboarding');
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <Screen style={styles.container}>
      <View style={styles.content}>
        <Image source={require('../../assets/images/Prologo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Pro Scanner</Text>
        <Text style={styles.subtitle}>Digitize your Docs</Text>
      </View>
      <Text style={styles.version}>Version {APP_VERSION}</Text>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingBottom: spacing.xxl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 121,
    height: 114,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.subtitle,
    marginTop: spacing.xs,
  },
  version: {
    ...typography.label,
    color: colors.textMuted,
  },
});

export default Intro;
