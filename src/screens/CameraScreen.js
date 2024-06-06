import React, { useState, useRef, useEffect } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera'; // Assuming CameraView is a valid export from 'expo-camera'
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';


export default function CameraScreen() {
  const [facing, setFacing] = useState('back'); 
  const [flashMode, setFlashMode] = useState('off');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions();
  const cameraRef = useRef(null);
  const [image, setImage] = useState(null);


  useEffect(() => {
    if (!mediaLibraryPermission) {
      requestMediaLibraryPermission();
    }
  }, []);

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

  const toggleFlashMode = () => {
    setFlashMode(current => {
      switch (current) {
        case 'off':
          return 'on';
        case 'on':
          return 'auto';
        case 'auto':
          return 'off';
        default:
          return 'off';
      }
    });
  };

  const pickImageFromGallery = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled) {
      setImage(result.uri);
    }
  };

  const saveImage = async () => {
    if (image) {
      try {
        await MediaLibrary.createAssetAsync(image);
        alert('Picture saved 💥💥');
        setImage(null);
      } catch (e) {
        console.log(e);
      }
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1, flashMode });
      setImage(photo.uri);
    }
  };

  const retakePicture = () => {
    setImage(null);
  };

  return (
    <View style={styles.container}>
      {image ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: image }} style={styles.preview} />
          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={retakePicture}>
              <Text style={styles.buttonText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={saveImage}>
              <Text style={styles.buttonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <CameraView
          style={styles.camera}
          facing={facing}
          flashMode={flashMode}
          ref={cameraRef}
        >
          <View style={styles.TopbuttonContainer}>
            <TouchableOpacity onPress={() => alert('Home icon clicked')}>
              <Image source={require('../../assets/icons/home.png')} style={styles.icon} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={toggleFlashMode}>
              <Image source={require('../../assets/icons/flashlight.png')} style={styles.flashicon} />
            </TouchableOpacity>
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.iconButton} onPress={pickImageFromGallery}>
            <Image source={require('../../assets/icons/gallery.png')} style={styles.icon} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.shutterButton} onPress={takePicture}>
              <Image source={require('../../assets/icons/Shutter.png')} style={styles.icon} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={toggleCameraFacing}>
            <Image source={require('../../assets/icons/backcamera.png')} style={styles.icon} />
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
    width: 40,
    height: 40,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Nunito_700Bold',
    color: 'white',
  },
});
