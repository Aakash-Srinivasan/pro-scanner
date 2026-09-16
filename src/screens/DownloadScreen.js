import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Screen from '../components/Screen';
import Header from '../components/Header';
import Button from '../components/Button';
import { useScanSession } from '../context/ScanSessionContext';
import { resetTo } from '../utils/navigation';
import { useTheme } from '../context/ThemeContext';

export default function DownloadScreen({ navigation }) {
  const { clearSession } = useScanSession();
  const { spacing } = useTheme();

  const goHome = () => {
    clearSession();
    resetTo(navigation, 'Home');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    gif: {
      width: 200,
      height: 200,
      marginBottom: spacing.xl,
    },
    buttonContainer: {
      width: '80%',
      alignItems: 'center',
    },
    fullWidth: {
      width: '100%',
    },
    homeButton: {
      marginTop: spacing.md,
    },
  });

  return (
    <Screen>
      <Header title="Download" onBack={() => navigation.goBack()} />
      <View style={styles.container}>
        <Image source={require('../../assets/gifs/download-animation.gif')} style={styles.gif} />

        <View style={styles.buttonContainer}>
          <Button title="Downloaded" variant="secondary" onPress={() => {}} style={styles.fullWidth} />
          <Button title="Home" onPress={goHome} style={[styles.fullWidth, styles.homeButton]} />
        </View>
      </View>
    </Screen>
  );
}
