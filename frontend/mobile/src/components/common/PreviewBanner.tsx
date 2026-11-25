import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Shown only in preview mode (frontend/preview-server), so sample data is never
// mistaken for real reports.
export function PreviewBanner() {
  const insets = useSafeAreaInsets();
  if (process.env.EXPO_PUBLIC_PREVIEW !== 'true') return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 72 }]}>
      <Text style={styles.text}>PREVIEW · sample data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#7A2E0E',
    opacity: 0.9,
  },
  text: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
});
