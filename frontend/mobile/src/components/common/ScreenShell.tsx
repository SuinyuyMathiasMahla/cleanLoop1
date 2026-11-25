import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, AppRole } from './AppHeader';
import { Rings } from './Rings';
import { colors } from '@/theme/colors';

interface ScreenShellProps {
  role: AppRole;
  title: string;
  subtitle?: string;
  /** Extra content rendered in the green area under the title (filters, tabs…). */
  headerExtra?: React.ReactNode;
  /** Element rendered at the right side of the title row. */
  titleRight?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Standard inner-screen layout: forest-green header with title, then a
 * rounded light sheet that holds the screen content (which scrolls itself).
 */
export function ScreenShell({
  role,
  title,
  subtitle,
  headerExtra,
  titleRight,
  children,
}: ScreenShellProps) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <SafeAreaView edges={['top']} style={styles.top}>
        <Rings />
        <AppHeader role={role} />
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          {titleRight}
        </View>
        {headerExtra}
      </SafeAreaView>
      <View style={styles.sheet}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  top: { backgroundColor: colors.primary, overflow: 'hidden', paddingBottom: 22 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.6 },
  subtitle: { fontSize: 13.5, lineHeight: 19, color: colors.mint, marginTop: 3 },
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
});
