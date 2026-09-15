import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, radius, typography } from '../theme';

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}) {
  const isSecondary = variant === 'secondary';

  return (
    <TouchableOpacity
      style={[
        styles.base,
        isSecondary ? styles.secondary : styles.primary,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator color={isSecondary ? colors.accent : colors.white} />
      ) : (
        <Text style={[styles.text, isSecondary ? styles.textSecondary : styles.textPrimary]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...typography.button,
  },
  textPrimary: {
    color: colors.white,
  },
  textSecondary: {
    color: colors.accent,
  },
});
