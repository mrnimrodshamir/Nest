import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { radius } from '@/theme';

const TEL_AVIV_YAFO_LOGO = require('../../assets/brands/tel-aviv-yafo-municipality.png');

export function EventSourceLogo({ accessibilityLabel }: { accessibilityLabel: string }) {
  return (
    <View pointerEvents="none" style={styles.badge}>
      <Image
        source={TEL_AVIV_YAFO_LOGO}
        resizeMode="contain"
        style={styles.logo}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    width: 76,
    height: 44,
    padding: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
  },
  logo: { width: '100%', height: '100%' },
});
