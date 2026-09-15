import { RFValue } from 'react-native-responsive-fontsize';

export const colors = {
  background: '#F7F7F9',
  surface: '#FFFFFF',
  text: '#1A1A1E',
  textMuted: '#6B6B76',
  border: '#E7E7EB',
  accent: '#9F149F',
  accentSoft: '#F3E1F5',
  danger: '#D64545',
  white: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 24,
  pill: 999,
};

export const typography = {
  title: { fontFamily: 'Nunito-Black', fontSize: RFValue(28), color: colors.text },
  subtitle: { fontFamily: 'Nunito-SemiBold', fontSize: RFValue(16), color: colors.textMuted },
  body: { fontFamily: 'Nunito-Regular', fontSize: RFValue(15), color: colors.text },
  button: { fontFamily: 'Nunito-Bold', fontSize: RFValue(15) },
  label: { fontFamily: 'Nunito-Bold', fontSize: RFValue(13), color: colors.textMuted },
};

export const shadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};
