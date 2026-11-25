import React from 'react';
import { ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './colors';

export const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.accent,
  tabBarInactiveTintColor: '#7f948c',
  tabBarStyle: {
    backgroundColor: colors.tabBar,
    borderTopWidth: 0,
    paddingTop: 6,
    elevation: 12,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
  tabBarBadgeStyle: {
    backgroundColor: colors.danger,
    color: '#fff',
    fontSize: 10,
    fontWeight: '800' as const,
  },
};

type IconName = keyof typeof Ionicons.glyphMap;

/** Filled icon when focused, outline otherwise — matches the CleanLoop tab bar. */
export function tabIcon(active: IconName, inactive: IconName) {
  return ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={size} color={color} />
  );
}
