import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import * as Font from 'expo-font';

const Intro = ({ navigation }) => {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    const loadFonts = async () => {
      await Font.loadAsync({
        'Nunito-Regular': require('../../assets/fonts/Nunito-Regular.ttf'),
        'Nunito-SemiBold': require('../../assets/fonts/Nunito-SemiBold.ttf'),
        'Nunito-Black': require('../../assets/fonts/Nunito-Black.ttf'),
      });
      setFontsLoaded(true);
    };

    loadFonts();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      const timer = setTimeout(() => {
        navigation.navigate('Slide1');
      }, 2000); 

      return () => clearTimeout(timer); 
    }
  }, [fontsLoaded, navigation]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/images/Prologo.png')} />
      <Text style={styles.title}>Pro Scanner</Text>
      <Text style={styles.subtitle}>Digital your Doc's</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 121,
    height: 114,
    marginBottom: 20,
  },
  title: {
    fontSize: 30,
    fontFamily: 'Nunito-Black',
  },
  subtitle: {
    fontFamily: 'Nunito-SemiBold',
    fontSize: 16,
    color: '#666',
  },
});

export default Intro;
