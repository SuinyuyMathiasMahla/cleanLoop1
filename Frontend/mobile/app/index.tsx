import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export default function Index() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  const role = user?.role?.toLowerCase();

  if (!user || role === 'admin') {
    return <Redirect href="/(guest)" />;
  }

  if (role === 'crew') {
    return <Redirect href="/(crew)/tabs" />;
  }

  return <Redirect href="/(citizen)/tabs" />;
}
