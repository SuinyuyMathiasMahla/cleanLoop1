import React from 'react';
import { View, StyleSheet } from 'react-native';

/** Decorative concentric rings in the top-right corner of forest-green headers. */
export function Rings() {
  return (
    <>
      <View pointerEvents="none" style={[styles.ring, styles.large]} />
      <View pointerEvents="none" style={[styles.ring, styles.medium]} />
      <View pointerEvents="none" style={[styles.ring, styles.small]} />
    </>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderColor: 'rgba(217,242,227,0.14)',
  },
  large: { width: 300, height: 300, borderWidth: 1.5, top: -130, right: -125 },
  medium: { width: 200, height: 200, borderWidth: 1.5, top: -60, right: -65 },
  small: {
    width: 95,
    height: 95,
    borderWidth: 11,
    top: 18,
    right: 5,
    borderColor: 'rgba(34,197,94,0.25)',
  },
});
