import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useReportStore } from '@/store/reportStore';

function AuthGate() {
  const { user, isLoading, loadStoredAuth } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Never show one account's alerts/reports to the next person who signs in
  useEffect(() => {
    if (!user) {
      useNotificationStore.getState().reset();
      useReportStore.setState({ myReports: [], allReports: [] });
    }
  }, [user?.userId]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';
    const inGuestGroup = segments[0] === '(guest)';
    const inCitizenGroup = segments[0] === '(citizen)';
    const inCrewGroup = segments[0] === '(crew)';

    if (!user) {
      if (!inGuestGroup && !inAuthGroup) router.replace('/(guest)');
      return;
    }

    // Normalize to lowercase — Cognito returns 'CREW', 'CITIZEN', 'ADMIN'
    const role = user.role?.toLowerCase();

    if (role === 'admin') {
      if (!inGuestGroup && !inAuthGroup) router.replace('/(guest)');
      return;
    }

    if (role === 'crew') {
      if (!inCrewGroup) router.replace('/(crew)/tabs');
      return;
    }

    // Citizens (and any unknown role) belong in the citizen group
    if (!inCitizenGroup) router.replace('/(citizen)/tabs');
  }, [user, isLoading, segments]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthGate />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(guest)" />
        <Stack.Screen name="(citizen)" />
        <Stack.Screen name="(crew)" />
        <Stack.Screen name="auth" />
      </Stack>
    </SafeAreaProvider>
  );
}
