import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { ScanSessionProvider } from './src/context/ScanSessionContext';
import { HistoryProvider } from './src/context/HistoryContext';
import Intro from './src/screens/Intro';
import OnboardingScreen from './src/screens/OnboardingScreen';
import CameraScreen from './src/screens/CameraScreen';
import PageEditScreen from './src/screens/PageEditScreen';
import PagesScreen from './src/screens/PagesScreen';
import PreviewScreen from './src/screens/PreviewScreen';
import DownloadScreen from './src/screens/DownloadScreen';
import HomeScreen from './src/screens/HomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import PdfCompressorScreen from './src/screens/PdfCompressorScreen';
import SignPdfScreen from './src/screens/SignPdfScreen';
import BackupRestoreScreen from './src/screens/BackupRestoreScreen';
import GuideScreen from './src/screens/GuideScreen';

const Stack = createNativeStackNavigator();

// Keeps the native splash screen visible until fonts are ready, instead of
// its default behavior of auto-hiding the moment the JS bundle renders
// anything at all - without this, App() briefly returning `null` while
// fonts load would let the splash vanish early into a blank frame, then pop
// back to the real Intro screen a moment later.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Reads the live theme so react-navigation's own chrome (the brief flash of
// background behind a screen transition, the status bar area) matches
// instead of defaulting to a plain white navigation theme in dark mode.
function Navigation() {
  const { isDark, colors } = useTheme();
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      {/* 'light' = light-colored icons/text (for a dark background), 'dark'
          = dark icons/text (for a light background) - so this is inverted
          from the app's own isDark flag, matching whichever status bar
          content is actually readable against the current theme. */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Navigator initialRouteName="Intro" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Intro" component={Intro} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Camera" component={CameraScreen} />
        <Stack.Screen name="PageEdit" component={PageEditScreen} />
        <Stack.Screen name="Pages" component={PagesScreen} />
        <Stack.Screen name="Preview" component={PreviewScreen} />
        <Stack.Screen name="Download" component={DownloadScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="PdfCompressor" component={PdfCompressorScreen} />
        <Stack.Screen name="SignPdf" component={SignPdfScreen} />
        <Stack.Screen name="BackupRestore" component={BackupRestoreScreen} />
        <Stack.Screen name="Guide" component={GuideScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    const loadFonts = async () => {
      await Font.loadAsync({
        'Nunito-Regular': require('./assets/fonts/Nunito-Regular.ttf'),
        'Nunito-SemiBold': require('./assets/fonts/Nunito-SemiBold.ttf'),
        'Nunito-Bold': require('./assets/fonts/Nunito-Bold.ttf'),
        'Nunito-Black': require('./assets/fonts/Nunito-Black.ttf'),
      });
      setFontsLoaded(true);
      // Only now is there something real to show - hides the native splash
      // directly into the fully-rendered Intro screen with no blank gap.
      await SplashScreen.hideAsync();
    };

    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <HistoryProvider>
          <ScanSessionProvider>
            <Navigation />
          </ScanSessionProvider>
        </HistoryProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
