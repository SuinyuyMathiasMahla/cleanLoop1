import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useReportStore } from '@/store/reportStore';
import { ReportCard } from '@/components/citizen/ReportCard';

const FOREST = '#0f3d2e';
const MINT = '#d9f2e3';
const LIGHT_GREEN = '#e8f5f0';

function StatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    { label: string; color: string; bg: string }
  > = {
    pending: {
      label: 'Pending',
      color: '#92400e',
      bg: '#fef3c7',
    },
    in_progress: {
      label: 'In Progress',
      color: '#1e40af',
      bg: '#dbeafe',
    },
    assigned: {
      label: 'Assigned',
      color: '#1e40af',
      bg: '#dbeafe',
    },
    resolved: {
      label: 'Resolved',
      color: '#065f46',
      bg: '#d1fae5',
    },
  };

  const s = map[status] ?? map.pending;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: s.bg },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          { color: s.color },
        ]}
      >
        {s.label}
      </Text>
    </View>
  );
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return '';

  const diff =
    Date.now() - new Date(dateStr).getTime();

  const h = Math.floor(diff / 3600000);

  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;

  return `${Math.floor(h / 24)}d ago`;
}

export default function GuestLanding() {
  const router = useRouter();

  const {
    publicReports,
    fetchPublicReports,
    isLoading,
  } = useReportStore();

  useEffect(() => {
    fetchPublicReports();
  }, []);

  const onRefresh = useCallback(() => {
    fetchPublicReports();
  }, []);

  const completedReports = publicReports.filter(
    (report) => report.status === 'resolved'
  );

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top']}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor={FOREST}
          />
        }
      >
        {/* =========================================
            TOP HEADER
        ========================================= */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoCircle}>
              <Ionicons
                name="leaf"
                size={18}
                color={FOREST}
              />
            </View>

            <View>
              <Text style={styles.brandName}>
                CleanLoop
              </Text>
              <Text style={styles.brandSub}>
                Cleaner communities
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() =>
                router.navigate('/auth/login')
              }
              activeOpacity={0.8}
            >
              <Text style={styles.loginButtonText}>
                Login
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signupButton}
              onPress={() =>
                router.navigate('/auth/register')
              }
              activeOpacity={0.8}
            >
              <Text style={styles.signupButtonText}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* =========================================
            HERO
        ========================================= */}
        <View style={styles.hero}>
          {/* Decorative rings */}
          <View
            style={[
              styles.ring,
              styles.ringLarge,
            ]}
          />

          <View
            style={[
              styles.ring,
              styles.ringMedium,
            ]}
          />

          <View
            style={[
              styles.ring,
              styles.ringSmall,
            ]}
          />

          <View style={styles.heroContent}>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroBadge}>
                <Ionicons
                  name="location-outline"
                  size={13}
                  color={MINT}
                />

                <Text style={styles.heroBadgeText}>
                  GPS Enabled
                </Text>
              </View>

              <View style={styles.heroBadge}>
                <Ionicons
                  name="time-outline"
                  size={13}
                  color={MINT}
                />

                <Text style={styles.heroBadgeText}>
                  Fast Cleanup
                </Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>
              Report waste.{'\n'}
              Keep your city{'\n'}
              clean.
            </Text>

            <Text style={styles.heroSub}>
              Help make your neighbourhood cleaner
              by reporting overflowing bins and
              illegal dumping.
            </Text>
          </View>
        </View>

        {/* =========================================
            WHITE CONTENT SHEET
        ========================================= */}
        <View style={styles.sheet}>
          {/* =====================================
              REPORT WASTE CARD
          ===================================== */}
          <View style={styles.actionCard}>
            <View style={styles.actionHeader}>
              <View style={styles.actionTitleArea}>
                <View style={styles.liveRow}>
                  <View style={styles.liveDot} />

                  <Text style={styles.liveText}>
                    QUICK REPORT
                  </Text>
                </View>

                <Text style={styles.actionTitle}>
                  Report Waste Now
                </Text>
              </View>

              <View style={styles.cameraChip}>
                <Ionicons
                  name="camera-outline"
                  size={16}
                  color={FOREST}
                />

                <Text style={styles.cameraChipText}>
                  Camera
                </Text>
              </View>
            </View>

            <Text style={styles.actionDescription}>
              Snap a photo, tag your location, and
              our cleanup crews will handle the rest.
            </Text>

            <TouchableOpacity
              style={styles.reportButton}
              onPress={() =>
                router.push('/(guest)/report')
              }
              activeOpacity={0.85}
            >
              <Ionicons
                name="camera"
                size={18}
                color="#fff"
              />

              <Text style={styles.reportButtonText}>
                Report Waste Now
              </Text>

              <Ionicons
                name="arrow-forward"
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          {/* =====================================
              COMMUNITY FEED
          ===================================== */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                Community Feed
              </Text>

              <Text style={styles.sectionSub}>
                Completed cleanups from your area
              </Text>
            </View>

            <View style={styles.sectionIcon}>
              <Ionicons
                name="people-outline"
                size={19}
                color={FOREST}
              />
            </View>
          </View>

          {isLoading &&
          completedReports.length === 0 ? (
            <ActivityIndicator
              color={FOREST}
              style={{
                marginVertical: 30,
              }}
            />
          ) : completedReports.length === 0 ? (
            <View style={styles.emptyFeed}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="leaf-outline"
                  size={28}
                  color={FOREST}
                />
              </View>

              <Text style={styles.emptyFeedTitle}>
                No completed cleanups yet
              </Text>

              <Text style={styles.emptyFeedText}>
                Community cleanup activity will
                appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.communityCards}>
              {completedReports
                .slice(0, 3)
                .map((report) => (
                  <ReportCard
                    key={report.reportId}
                    report={report}
                    style={styles.communityReportCard}
                  />
                ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ============================================
  // ROOT
  // ============================================

  safe: {
    flex: 1,
    backgroundColor: FOREST,
  },

  scroll: {
    flexGrow: 1,
    backgroundColor: '#f5f8f6',
    paddingBottom: 30,
  },

  // ============================================
  // HEADER
  // ============================================

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: FOREST,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  logoCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  brandName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },

  brandSub: {
    fontSize: 10,
    color: MINT,
    marginTop: 1,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  loginButton: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },

  loginButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },

  signupButton: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
  },

  signupButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: FOREST,
  },

  // ============================================
  // HERO
  // ============================================

  hero: {
    backgroundColor: FOREST,
    minHeight: 300,
    paddingHorizontal: 22,
    paddingBottom: 58,
    overflow: 'hidden',
  },

  heroContent: {
    zIndex: 2,
  },

  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderColor: 'rgba(217,242,227,0.14)',
  },

  ringLarge: {
    width: 300,
    height: 300,
    borderWidth: 1.5,
    top: -130,
    right: -125,
  },

  ringMedium: {
    width: 200,
    height: 200,
    borderWidth: 1.5,
    top: -60,
    right: -65,
  },

  ringSmall: {
    width: 95,
    height: 95,
    borderWidth: 11,
    top: 18,
    right: 5,
    borderColor: 'rgba(34,197,94,0.25)',
  },

  heroBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 22,
  },

  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  heroBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: MINT,
  },

  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.8,
    marginBottom: 10,
  },

  heroSub: {
    maxWidth: 330,
    fontSize: 14,
    lineHeight: 21,
    color: MINT,
  },

  // ============================================
  // WHITE SHEET
  // ============================================

  sheet: {
    backgroundColor: '#ffffff',
    marginTop: -28,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 35,
    minHeight: 400,
  },

  // ============================================
  // REPORT CARD
  // ============================================

  actionCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e1ebe6',
    borderRadius: 22,
    padding: 18,
    marginBottom: 28,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },

  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 9,
  },

  actionTitleArea: {
    flex: 1,
  },

  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },

  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#22a05a',
    letterSpacing: 0.9,
  },

  actionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10251d',
    letterSpacing: -0.3,
  },

  cameraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: LIGHT_GREEN,
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  cameraChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: FOREST,
  },

  actionDescription: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#6b7c76',
    marginBottom: 16,
  },

  reportButton: {
    height: 52,
    borderRadius: 15,
    backgroundColor: FOREST,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  reportButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.1,
  },

  // ============================================
  // COMMUNITY SECTION
  // ============================================

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10251d',
    letterSpacing: -0.3,
    marginBottom: 3,
  },

  sectionSub: {
    fontSize: 12.5,
    color: '#74847e',
  },

  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },

  communityCards: {
    marginHorizontal: -2,
  },

  communityReportCard: {
    marginHorizontal: 0,
    marginBottom: 10,
  },

  // ============================================
  // EMPTY STATE
  // ============================================

  emptyFeed: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 35,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#f8fbf9',
    borderWidth: 1,
    borderColor: '#e5eee9',
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  emptyFeedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#263b33',
    marginBottom: 5,
  },

  emptyFeedText: {
    fontSize: 12.5,
    color: '#87958f',
    textAlign: 'center',
    lineHeight: 18,
  },

  // ============================================
  // STATUS BADGE
  // ============================================

  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});