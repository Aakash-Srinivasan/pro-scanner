import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Font from 'expo-font';

const Slide2 = () => {
  const navigation = useNavigation();
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    const loadFonts = async () => {
      await Font.loadAsync({
        'Nunito-Regular': require('../../assets/fonts/Nunito-Regular.ttf'),
        'Nunito-Bold': require('../../assets/fonts/Nunito-Bold.ttf'),
      });
      setFontsLoaded(true);
    };

    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  const handleSkip = () => {
    navigation.navigate('Camera'); // Navigate to CameraScreen
  };

  const handleNext = () => {
    navigation.navigate('Slide3'); // Navigate to Slide3
  };

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/images/slide2.png')} style={styles.logo} />
      <View style={styles.quotescontainer}>
        <Text style={styles.quotes}>You can also edit </Text>
        <Text style={styles.quotes}>and </Text>
        <Text style={styles.quotes}>customize your PDF</Text>
        <Image source={require('../../assets/icons/nav2.png')} style={styles.icon} />
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
    width: 201,
    height: 201,
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

export default Slide2;
