import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';

export default function HomeScreen({ navigation }) {
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pro Scanner</Text>
      <Text style={styles.subtitle}>Documents</Text>
      <TouchableOpacity style={styles.cameraButtons}  onPress={() => navigation.navigate('Camera')}>
        <Image source={require('../../assets/icons/camera.png')} style={styles.addicon} />
        </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButtons: {
    width: 100,
    height: 100,
    marginTop:500,
    marginLeft:275,
  },
  title: {
    marginTop:100,
    marginRight:200,
    fontSize: 30,
    fontFamily: 'Nunito_700Bold',
  },
  subtitle: {
    marginTop:10,
    marginRight:220,
    fontSize: 16,
    fontFamily: 'Nunito_700Bold',
  },
});
