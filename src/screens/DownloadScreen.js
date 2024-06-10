import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';

export default function DownloadScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.arrow} onPress={() => navigation.goBack()}>
        <Image source={require('../../assets/icons/arrow-left.png')} style={styles.arrowicon} />
      </TouchableOpacity>
      
      {/* Display the GIF */}
      <Image source={require('../../assets/gifs/download-animation.gif')} style={styles.gif} />

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.btn1}>
          <View style={styles.btn}>
            <Image source={require('../../assets/icons/done.png')} style={styles.icon} />
            <Text style={styles.buttonText1}>Downloaded</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn2} onPress={() => navigation.navigate('Home')}>
          <View style={styles.btn}>
            <Image source={require('../../assets/icons/home.png')} style={styles.icon} />
            <Text style={styles.buttonText2}>Home</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow:{
    marginTop:50,
   marginBottom:100,
   marginRight:300,
  },
  arrowicon:{
    width: 24,
    height: 24,
  },
  icon: {
    width: 24,
    height: 24,
    margin: 10,
  },
  gif: {
    width: 200, // Adjust size as needed
    height: 200, // Adjust size as needed
    marginVertical: 20, // Add some margin for spacing
  },
  buttonContainer: {
    flexDirection: 'column',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  btn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btn1: {
    width: 246,
    height: 50,
    alignContent: 'center',
    backgroundColor: '#5FEF7E',
    borderRadius: 25,
  },
  buttonText1: {
    fontFamily: 'Nunito-Bold',
    textAlign: 'center',
    color: 'black',
    fontSize: 20,
    fontWeight: '500',
  },
  btn2: {
    width: 246,
    height: 47,
    fontFamily: 'Nunito-Bold',
    alignItems: 'center',
    backgroundColor: '#9F149F',
    borderRadius: 25,
    marginTop: 100,
  },
  buttonText2: {
    textAlign: 'center',
    color: 'white',
    fontSize: 20,
    fontWeight: '500',
  },
});
