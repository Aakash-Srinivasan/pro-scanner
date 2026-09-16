import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RFValue } from 'react-native-responsive-fontsize';

const THEME_STORAGE_KEY = 'pro-scanner:theme-preference';

// Non-color tokens don't change between light and dark, so they stay plain
// constants rather than being rebuilt per-theme.
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 8, md: 14, lg: 24, pill: 999 };

const lightColors = {
  background: '#F7F7F9',
  surface: '#FFFFFF',
  text: '#1A1A1E',
  textMuted: '#6B6B76',
  border: '#E7E7EB',
  accent: '#9F149F',
  accentSoft: '#F3E1F5',
  danger: '#D64545',
  white: '#FFFFFF',
};

const darkColors = {
  background: '#0F0F11',
  surface: '#1C1C1F',
  text: '#F2F2F3',
  textMuted: '#9498A2',
  border: '#2C2C31',
  accent: '#D06BD8',
  accentSoft: '#3B2340',
  danger: '#FF7A7A',
  white: '#FFFFFF',
};

// Typography objects bake in a default text color (title/body/subtitle),
// so they're built from whichever palette is active rather than being a
// static constant like spacing/radius.
function buildTypography(colors) {
  return {
    title: { fontFamily: 'Nunito-Black', fontSize: RFValue(28), color: colors.text },
    subtitle: { fontFamily: 'Nunito-SemiBold', fontSize: RFValue(16), color: colors.textMuted },
    body: { fontFamily: 'Nunito-Regular', fontSize: RFValue(15), color: colors.text },
    button: { fontFamily: 'Nunito-Bold', fontSize: RFValue(15) },
    label: { fontFamily: 'Nunito-Bold', fontSize: RFValue(13), color: colors.textMuted },
  };
}

// Shadows read the same in both themes (a soft dark shadow still reads
// correctly against a dark surface) so this stays fixed rather than
// per-palette.
const shadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  // 'system' follows the OS setting (via systemScheme); 'light'/'dark' are
  // an explicit user override, persisted so it sticks across app restarts.
  const [preference, setPreference] = useState('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setPreference(saved);
        }
      })
      .catch((error) => console.error('Error loading theme preference:', error));
  }, []);

  const setThemePreference = (next) => {
    setPreference(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch((error) =>
      console.error('Error saving theme preference:', error)
    );
  };

  const scheme = preference === 'system' ? (systemScheme || 'light') : preference;
  const isDark = scheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const value = useMemo(
    () => ({
      colors,
      spacing,
      radius,
      typography: buildTypography(colors),
      shadow,
      isDark,
      themePreference: preference,
      setThemePreference,
    }),
    [colors, isDark, preference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
