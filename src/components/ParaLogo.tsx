import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export const ParaLogo: React.FC<{ size?: number }> = ({ size = 24 }) => {
  const { colors } = useTheme();
  return (
    <Text style={[styles.wordmark, { color: colors.text, fontSize: size }]}>
      para
    </Text>
  );
};

const styles = StyleSheet.create({
  wordmark: {
    fontWeight: '800',
    letterSpacing: -1.2,
    includeFontPadding: false,
  },
});
