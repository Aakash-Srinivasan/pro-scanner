import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Alert, Text, Image, TouchableOpacity } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function PreviewScreen({ route, navigation }) {
  const { pdfBytes } = route.params;
  const [fileName, setFileName] = useState('image.pdf');

  const validateFileName = (name) => {
    if (!name.endsWith('.pdf')) {
      return `${name}.pdf`;
    }
    return name;
  };

  const savePDF = async () => {
    if (!pdfBytes) return;

    try {
      const validatedFileName = validateFileName(fileName);
      const pdfUri = `${FileSystem.documentDirectory}${validatedFileName}`;
      await FileSystem.writeAsStringAsync(pdfUri, pdfBytes, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('PDF saved at:', pdfUri);
      Alert.alert('Success', `PDF saved as ${validatedFileName}`);
    } catch (error) {
      console.error('Error saving PDF:', error);
      Alert.alert('Error', 'Failed to save PDF');
    }
  };

  const sharePDF = async () => {
    if (!pdfBytes) return;

    try {
      const validatedFileName = validateFileName(fileName);
      const pdfUri = `${FileSystem.documentDirectory}${validatedFileName}`;
      await FileSystem.writeAsStringAsync(pdfUri, pdfBytes, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Share the PDF
      await Sharing.shareAsync(pdfUri);
    } catch (error) {
      console.error('Error sharing PDF:', error);
      Alert.alert('Error', 'Failed to share PDF');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.Editcontainer}>
        <Text style={styles.stylestext}>FileName:</Text>
        <TextInput
          style={styles.input}
          value={fileName}
          onChangeText={setFileName}
          placeholder="Enter file name"
        />
        <TouchableOpacity style={styles.editBtn} onPress={() => {/* Your edit logic */}}>
          <Image source={require('../../assets/icons/edit.png')} style={styles.icon} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.addButtons} onPress={() => {/* Your add images logic */}}>
        <Image source={require('../../assets/icons/add.png')} style={styles.addicon} />
        <Text style={styles.Text}>Add More Images</Text>
      </TouchableOpacity>

      <View style={styles.Buttoncontainer}>
        <TouchableOpacity style={styles.Buttons} onPress={() => {/* Your edit logic */}}>
          <Image source={require('../../assets/icons/wEdit.png')} style={styles.icon} />
          <Text style={styles.Buttontext}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.Buttons} onPress={() => navigation.navigate('Download')}>
          <Image source={require('../../assets/icons/download.png')} style={styles.icon} />
          <Text style={styles.Buttontext}>Download</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.Buttons} onPress={savePDF}>
          <Image source={require('../../assets/icons/save.png')} style={styles.icon} />
          <Text style={styles.Buttontext}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.Buttons} onPress={sharePDF}>
          <Image source={require('../../assets/icons/share.png')} style={styles.icon} />
          <Text style={styles.Buttontext}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.Buttons} onPress={() => navigation.navigate('Camera', { resetImageUri: true })}>
          <Image source={require('../../assets/icons/rescan.png')} style={styles.icon} />
          <Text style={styles.Buttontext}>ReScan</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  Editcontainer: {
    justifyContent: 'center',
    alignContent: 'center',
    flexDirection: 'row',
    marginTop: 100,
  },
  stylestext: {
    marginTop: 5,
    fontFamily: 'Nunito-Bold',
    textAlign: 'center',
    color: 'black',
    fontSize: 14,
  },
  input: {
    height: 30,
    borderColor: 'gray',
    marginBottom: 20,
    paddingHorizontal: 10,
    width: '30%',
    borderRadius: 20,
  },
  icon: {
    width: 24,
    height: 24,
  },
  addicon: {
    width: 34,
    height: 34,
  },
  addButtons: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 450,
  },
  Buttoncontainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#9F149F',
    padding: 30,
    borderRadius: 0,
    marginTop: 50,
  },
  Buttons: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  Buttontext: {
    fontFamily: 'Nunito-Bold',
    color: 'white',
  },
  Text: {
    fontFamily: 'Nunito-Bold',
    color: 'black',
  },
});
