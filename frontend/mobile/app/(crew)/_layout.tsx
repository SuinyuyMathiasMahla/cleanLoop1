import { Tabs } from 'expo-router';
import { useNotificationStore } from '@/store/notificationStore';
import { useNotificationSync } from '@/hooks/useNotificationSync';
import { tabIcon, tabScreenOptions } from '@/theme/tabBar';

export default function CrewLayout() {
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  useNotificationSync();

  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="tabs/index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="tabs/tasks"
        options={{ title: 'Tasks', tabBarIcon: tabIcon('clipboard', 'clipboard-outline') }}
      />
      <Tabs.Screen
        name="tabs/report"
        options={{ title: 'Record', tabBarIcon: tabIcon('stats-chart', 'stats-chart-outline') }}
      />
      <Tabs.Screen
        name="tabs/notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: tabIcon('notifications', 'notifications-outline'),
          tabBarBadge: unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : undefined,
        }}
      />
      <Tabs.Screen
        name="tabs/profile"
        options={{ title: 'Profile', tabBarIcon: tabIcon('person', 'person-outline') }}
      />
      {/* Task detail is a pushed screen, not a tab */}
      <Tabs.Screen name="task/[id]" options={{ href: null }} />
    </Tabs>
  );
}
