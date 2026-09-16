import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export default function Screen({ children, style, edges }) {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <View style={[styles.container, style]}>{children}</View>
    </SafeAreaView>
  );
}
