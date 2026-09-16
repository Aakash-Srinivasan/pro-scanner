import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RFValue } from 'react-native-responsive-fontsize';
import { useTheme } from '../context/ThemeContext';

// `titleContent` swaps in custom content (e.g. an editable filename) in
// place of the plain title text - subtitle still renders underneath it
// exactly as it would with a plain title, so callers don't lose that row.
export default function Header({ title, subtitle, onBack, right, titleContent }) {
  const { colors, spacing, typography } = useTheme();
  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sideLeft: {
      width: 40,
      alignItems: 'flex-start',
    },
    sideRight: {
      minWidth: 40,
      alignItems: 'flex-end',
    },
    center: {
      flex: 1,
      alignItems: 'center',
    },
    title: {
      ...typography.title,
      fontSize: RFValue(18),
    },
    subtitle: {
      ...typography.subtitle,
      fontSize: RFValue(13),
      marginTop: 2,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.sideLeft}>
        {onBack && (
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.center}>
        {titleContent ?? <Text style={styles.title} numberOfLines={1}>{title}</Text>}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.sideRight}>{right}</View>
    </View>
  );
}
