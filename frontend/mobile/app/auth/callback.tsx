import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const completeGoogleSignIn = useAuthStore((s) => s.completeGoogleSignIn);
  const [failed, setFailed] = useState(false);
  const handled = useRef(false);

  async function processUrl(url: string | null) {
    if (!url || handled.current) return;
    if (!url.startsWith('cleanloop://auth/callback')) return;
    handled.current = true;

    try {
      await completeGoogleSignIn(url);
      // Navigation is handled automatically by the AuthGate in _layout.tsx
      // once the user is set in the store.
    } catch {
      setFailed(true);
      setTimeout(() => router.replace('/auth/login'), 2500);
    }
  }

  useEffect(() => {
    // Cold start: app was killed before the redirect — read the URL that launched it
    Linking.getInitialURL().then(processUrl);

    // Warm start: app was backgrounded — the URL fires as an event
    const subscription = Linking.addEventListener('url', ({ url }) => processUrl(url));

    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        {failed ? (
          <Text style={styles.errorLabel}>Sign-in failed. Returning to login…</Text>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.label}>Completing Google sign-in…</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  label: { fontSize: 14, color: colors.gray[700] },
  errorLabel: { fontSize: 14, color: colors.danger },
});