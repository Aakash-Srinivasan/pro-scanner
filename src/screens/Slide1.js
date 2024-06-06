import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Font from 'expo-font';

const Slide1 = () => {
  const navigation = useNavigation();
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    const loadFonts = async () => {
      await Font.loadAsync({
        Nunito_400Regular: require('../../assets/fonts/Nunito-Regular.ttf'),
        Nunito_700Bold: require('../../assets/fonts/Nunito-Bold.ttf'),
      });
      setFontsLoaded(true);
    };

    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  const handleSkip = () => {
    navigation.navigate('CameraScreen'); // Navigate to CameraScreen
  };

  const handleNext = () => {
    navigation.navigate('Slide2'); // Navigate to Slide2
  };

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/images/slide1.png')} style={styles.logo} />
      <View style={styles.quotescontainer}>
        <Text style={styles.quotes}>Scan all your Documents</Text>
        <Text style={styles.quotes}>easily convert into PDF quickly</Text>
        <Image source={require('../../assets/icons/nav.png')} style={styles.icon} />
      </View>
       <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.btnskip} onPress={handleSkip}>
          <Text style={styles.buttonText1}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnnext} onPress={handleNext}>
          <Text style={styles.buttonText2}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent:'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  logo: {
    marginTop:200,
    width: 244,
    height: 244,
  },
  quotescontainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom:20,
  },
  quotes: {
    fontFamily: 'Nunito-Bold',
    fontSize: 20,
    textAlign: 'center',
    fontWeight: '500',
    
  },
 icon:{
   marginTop:20
 },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent:'center',
    justifyContent: 'space-around',
    marginBottom:30,
  },
  btnskip: {
    width: 157,
    height: 50,
    alignContent: 'center',
    backgroundColor: '#FFB2FF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  buttonText1: {
    fontFamily: 'Nunito-Bold',
    textAlign: 'center',
    color: 'black',
    fontSize: 20,
    fontWeight: '500',
  },
  btnnext: {
    width: 157,
    height: 47,
    fontFamily: 'Nunito-Bold',
    marginLeft: 20,
    alignContent: 'center',
    backgroundColor: '#9F149F',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  buttonText2: {
    textAlign: 'center',
    color: 'white',
    fontSize: 20,
    fontWeight: '500',
  },
});

export default Slide1;
