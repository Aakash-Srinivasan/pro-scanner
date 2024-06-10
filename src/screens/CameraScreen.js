import React, { useState, useRef, useEffect } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { PDFDocument } from 'pdf-lib';
import * as FileSystem from 'expo-file-system';

export default function CameraScreen({ route, navigation }) {
  const [facing, setFacing] = useState('back');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions();
  const cameraRef = useRef(null);
  const [imageUri, setImageUri] = useState(null);

  useEffect(() => {
    if (!mediaLibraryPermission) {
      requestMediaLibraryPermission();
    }
  }, []);

  useEffect(() => {
    if (route.params?.resetImageUri) {
      setImageUri(null);
    }
  }, [route.params]);

  if (!cameraPermission || !mediaLibraryPermission) {
    return <View />;
  }

  if (!cameraPermission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>We need your permission to show the camera</Text>
        <Button onPress={requestCameraPermission} title="Grant Camera Permission" />
      </View>
    );
  }

  if (!mediaLibraryPermission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>We need your permission to access the media library</Text>
        <Button onPress={requestMediaLibraryPermission} title="Grant Media Library Permission" />
      </View>
    );
  }

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const pickImageFromGallery = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      await convertImageToPDF(uri);
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
      setImageUri(photo.uri);
    }
  };

  const convertImageToPDF = async (uri) => {
    if (!uri) return;

    try {
      console.log('Image URI:', uri);

      const imageBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('Base64 Image Length:', imageBase64.length);

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();

      const jpgImage = await pdfDoc.embedJpg(imageBase64);
      const { width, height } = jpgImage.size();
      page.drawImage(jpgImage, {
        x: 0,
        y: 0,
        width: page.getWidth(),
        height: (height / width) * page.getWidth(),
      });

      const pdfBytes = await pdfDoc.saveAsBase64();

      navigation.navigate('Preview', { pdfBytes });
    } catch (error) {
      console.error('Error converting image to PDF:', error);
    }
  };

  return (
    <View style={styles.container}>
      {imageUri ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: imageUri }} style={styles.preview} />
          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={() => setImageUri(null)}>
              <Text style={styles.buttonText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => convertImageToPDF(imageUri)}>
              <Text style={styles.buttonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <CameraView
          style={styles.camera}
          facing={facing}
          ref={cameraRef}
        >
          <View style={styles.TopbuttonContainer}>
            <TouchableOpacity onPress={() => navigation.navigate('Home')}>
              <Image source={require('../../assets/icons/home.png')} style={styles.icon} />
            </TouchableOpacity>
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.iconButton} onPress={pickImageFromGallery}>
              <Image source={require('../../assets/icons/gallery.png')} style={styles.bottomicon} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.shutterButton} onPress={takePicture}>
              <Image source={require('../../assets/icons/Shutter.png')} style={styles.bottomicon} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={toggleCameraFacing}>
              <Image source={require('../../assets/icons/backcamera.png')} style={styles.bottomicon} />
            </TouchableOpacity>
          </View>
        </CameraView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  camera: {
    flex: 1,
  },
  TopbuttonContainer: {
    position: 'absolute',
    marginTop: 30,
    marginLeft: 10,
    padding: 20,
    alignItems: 'center',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#9F149F',
    padding: 20,
  },
  flashicon: {
    marginTop: 20,
    width: 40,
    height: 40,
  },
  iconButton: {
    alignItems: 'center',
  },
  shutterButton: {
    alignItems: 'center',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    padding: 20,
    position: 'absolute',
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  icon: {
    width: 30,
    height: 30,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Nunito_700Bold',
    color: 'white',
  },
  bottomicon: {
    width: 40,
    height: 40,
  },
});

