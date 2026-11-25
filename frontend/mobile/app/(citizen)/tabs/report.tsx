import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { ScreenShell } from '@/components/common/ScreenShell';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useReportStore } from '@/store/reportStore';
import { useAuthStore } from '@/store/authStore';
import { getCurrentLocation } from '@/services/location';
import { getApiErrorMessage } from '@/services/api';
import { colors } from '@/theme/colors';

type ReportType = 'overflow_bin' | 'illegal_dumping';

interface Place {
  latitude: number;
  longitude: number;
  address: string;
}

const TYPES: { key: ReportType; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'overflow_bin', label: 'Overflowing bin', hint: 'Bin is full or spilling', icon: 'trash' },
  { key: 'illegal_dumping', label: 'Illegal dumping', hint: 'Waste left in the open', icon: 'warning' },
];

export default function CitizenReportScreen() {
  const router = useRouter();
  const { submitReport, submitGuestReport, isSubmitting, fetchMyReports } = useReportStore();
  const user = useAuthStore((s) => s.user);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const [photo, setPhoto] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>('overflow_bin');
  const [description, setDescription] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);

  const fetchLocation = useCallback(async () => {
    setLocating(true);
    setLocationError('');
    try {
      setPlace(await getCurrentLocation());
    } catch (err) {
      setPlace(null);
      setLocationError(err instanceof Error ? err.message : 'Could not get your location');
    } finally {
      setLocating(false);
    }
  }, []);

  // Only run the camera while this tab is visible (saves battery, avoids black preview)
  useFocusEffect(
    useCallback(() => {
      setCameraActive(true);
      fetchLocation();
      return () => {
        setCameraActive(false);
        setCameraReady(false);
      };
    }, [fetchLocation]),
  );

  async function handleCapture() {
    if (!cameraRef.current || !cameraReady || capturing) return;
    setCapturing(true);
    try {
      const result = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false });
      if (result?.uri) setPhoto(result.uri);
    } catch {
      Alert.alert('Error', 'Could not take photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  }

  function resetForm() {
    setPhoto(null);
    setDescription('');
    setReportType('overflow_bin');
    setCameraReady(false);
  }

  async function handleSubmit() {
    if (!photo) {
      Alert.alert('Photo required', 'Please take a photo of the waste issue.');
      return;
    }
    if (!place) {
      Alert.alert('Location required', 'We need your location to file this report.');
      return;
    }
    try {
      const payload = {
        type: reportType,
        latitude: place.latitude,
        longitude: place.longitude,
        address: place.address,
        description: description.trim() || undefined,
        photo,
      };
      if (user) await submitReport(payload);
      else await submitGuestReport(payload);

      resetForm();
      fetchMyReports();
      Alert.alert('Report submitted', 'Thank you! Our crews have been notified.', [
        { text: 'View my reports', onPress: () => router.navigate('/(citizen)/tabs/my-reports' as any) },
      ]);
    } catch (err) {
      Alert.alert('Submission failed', getApiErrorMessage(err));
    }
  }

  if (!permission) return <LoadingSpinner fullScreen />;

  const canSubmit = !!photo && !!place && !isSubmitting;

  return (
    <ScreenShell
      role="citizen"
      title="Report Waste"
      subtitle="Photo and location are captured live"
    >
      {!permission.granted ? (
        <View style={styles.permWrap}>
          <View style={styles.permIcon}>
            <Ionicons name="camera-outline" size={38} color={colors.primary} />
          </View>
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permSub}>
            CleanLoop uses your live camera so every report is real and location-tagged.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Grant camera access</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Camera */}
            <View style={styles.cameraCard}>
              {photo ? (
                <>
                  <Image source={{ uri: photo }} style={styles.camera} />
                  <TouchableOpacity
                    style={styles.retake}
                    onPress={() => {
                      setPhoto(null);
                      setCameraReady(false);
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="refresh" size={15} color="#fff" />
                    <Text style={styles.retakeText}>Retake</Text>
                  </TouchableOpacity>
                </>
              ) : cameraActive ? (
                <CameraView
                  ref={cameraRef}
                  style={styles.camera}
                  facing="back"
                  onCameraReady={() => setCameraReady(true)}
                >
                  <View style={styles.camTop}>
                    <View style={styles.pill}>
                      <View style={styles.liveDot} />
                      <Text style={styles.pillText}>LIVE</Text>
                    </View>
                  </View>
                  <View style={styles.frame} pointerEvents="none">
                    <View style={[styles.corner, styles.tl]} />
                    <View style={[styles.corner, styles.tr]} />
                    <View style={[styles.corner, styles.bl]} />
                    <View style={[styles.corner, styles.br]} />
                  </View>
                  <View style={styles.camBottom}>
                    <TouchableOpacity
                      style={[styles.shutter, (!cameraReady || capturing) && { opacity: 0.5 }]}
                      onPress={handleCapture}
                      disabled={!cameraReady || capturing}
                      activeOpacity={0.85}
                      accessibilityLabel="Take photo"
                    >
                      {capturing ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : (
                        <View style={styles.shutterInner} />
                      )}
                    </TouchableOpacity>
                  </View>
                </CameraView>
              ) : (
                <View style={[styles.camera, styles.cameraOff]} />
              )}
            </View>

            {/* Location status */}
            <View style={[styles.locationCard, !!locationError && styles.locationCardError]}>
              <View style={[styles.locationIcon, !!locationError && { backgroundColor: '#fee2e2' }]}>
                {locating ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name={locationError ? 'location-outline' : 'location'}
                    size={18}
                    color={locationError ? colors.danger : colors.primary}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.locationTitle}>
                  {locating ? 'Finding your location…' : locationError ? 'Location unavailable' : 'Location tagged'}
                </Text>
                <Text style={styles.locationSub} numberOfLines={2}>
                  {locationError || place?.address || (locating ? 'Acquiring GPS lock' : 'Tap refresh to retry')}
                </Text>
              </View>
              {!locating && (
                <TouchableOpacity onPress={fetchLocation} accessibilityLabel="Refresh location" hitSlop={10}>
                  <Ionicons name="refresh" size={19} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Type */}
            <Text style={styles.label}>What are you reporting?</Text>
            <View style={styles.typeRow}>
              {TYPES.map((t) => {
                const active = reportType === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.typeCard, active && styles.typeCardActive]}
                    onPress={() => setReportType(t.key)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.typeIcon, active && styles.typeIconActive]}>
                      <Ionicons name={t.icon} size={18} color={active ? '#fff' : colors.primary} />
                    </View>
                    <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{t.label}</Text>
                    <Text style={styles.typeHint}>{t.hint}</Text>
                    {active && (
                      <View style={styles.typeCheck}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Description */}
            <View style={styles.labelRow}>
              <Text style={styles.label}>Description</Text>
              <Text style={styles.optional}>optional</Text>
            </View>
            <TextInput
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the issue — e.g. bin by the market is overflowing"
              placeholderTextColor={colors.gray[300]}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.primaryBtn, !canSubmit && { opacity: 0.5 }]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={17} color="#fff" />
                  <Text style={styles.primaryBtnText}>Submit report</Text>
                </>
              )}
            </TouchableOpacity>
            {!photo && <Text style={styles.hint}>Take a photo to enable submitting.</Text>}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, paddingBottom: 36 },

  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36 },
  permIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  permTitle: { fontSize: 20, fontWeight: '800', color: colors.gray[900], marginBottom: 8, textAlign: 'center' },
  permSub: { fontSize: 14, color: colors.gray[500], textAlign: 'center', lineHeight: 20, marginBottom: 24 },

  cameraCard: { height: 360, borderRadius: 1, overflow: 'hidden', backgroundColor: '#0b1f18' },
  camera: { width: '100%', height: '100%' },
  cameraOff: { backgroundColor: '#0b1f18' },
  camTop: { flexDirection: 'row', padding: 14 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  frame: { ...StyleSheet.absoluteFill, margin: 36 },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: colors.accent },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },
  camBottom: { position: 'absolute', bottom: 18, left: 0, right: 0, alignItems: 'center' },
  shutter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff' },
  retake: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retakeText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 1,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginTop: 14,
  },
  locationCardError: { borderColor: '#fecaca', backgroundColor: '#fffafa' },
  locationIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTitle: { fontSize: 13.5, fontWeight: '800', color: colors.gray[900] },
  locationSub: { fontSize: 12, color: colors.gray[500], marginTop: 2 },

  label: { fontSize: 14, fontWeight: '800', color: colors.gray[900], marginTop: 22, marginBottom: 10 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  optional: { fontSize: 11.5, color: colors.gray[300], fontWeight: '600' },

  typeRow: { flexDirection: 'row', gap: 10 },
  typeCard: {
    flex: 1,
    padding: 14,
    borderRadius: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  typeCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  typeIcon: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  typeIconActive: { backgroundColor: colors.primary },
  typeLabel: { fontSize: 14, fontWeight: '800', color: colors.gray[900] },
  typeLabelActive: { color: colors.primary },
  typeHint: { fontSize: 11.5, color: colors.gray[500], marginTop: 2 },
  typeCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textArea: {
    minHeight: 96,
    backgroundColor: '#fff',
    borderRadius: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
    color: colors.gray[900],
  },

  primaryBtn: {
    height: 54,
    borderRadius: 6,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 24,
    alignSelf: 'stretch',
  },
  primaryBtnText: { fontSize: 15.5, fontWeight: '700', color: '#fff' },
  hint: { textAlign: 'center', fontSize: 12.5, color: colors.gray[500], marginTop: 10 },
});
