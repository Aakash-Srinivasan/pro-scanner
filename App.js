import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Font from 'expo-font';
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
import GuideScreen from './src/screens/GuideScreen';

const Stack = createNativeStackNavigator();

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
    };

    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <HistoryProvider>
        <ScanSessionProvider>
          <NavigationContainer>
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
              <Stack.Screen name="Guide" component={GuideScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </ScanSessionProvider>
      </HistoryProvider>
    </SafeAreaProvider>
  );
}

export default App;
