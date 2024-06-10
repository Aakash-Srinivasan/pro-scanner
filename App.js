import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Font from 'expo-font';
import Intro from './src/screens/Intro';
import Slide1 from './src/screens/Slide1';
import Slide2 from './src/screens/Slide2';
import Slide3 from './src/screens/Slide3';
import CameraScreen from './src/screens/CameraScreen';
import PreviewScreen from './src/screens/PreviewScreen';
import DownloadScreen from './src/screens/DownloadScreen';
import HomeScreen from './src/screens/HomeScreen';

const Stack = createStackNavigator();

function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    const loadFonts = async () => {
      await Font.loadAsync({
        'Nunito-Regular': require('./assets/fonts/Nunito-Regular.ttf'),
        'Nunito-Bold': require('./assets/fonts/Nunito-Bold.ttf'),
      });
      setFontsLoaded(true);
    };

    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Intro" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Intro" component={Intro} />
        <Stack.Screen name="Slide1" component={Slide1} />
        <Stack.Screen name="Slide2" component={Slide2} />
        <Stack.Screen name="Slide3" component={Slide3} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Camera" component={CameraScreen} />
        <Stack.Screen name="Preview" component={PreviewScreen} />
        <Stack.Screen name="Download" component={DownloadScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
