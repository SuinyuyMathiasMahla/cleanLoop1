import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Image,
  Switch,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button } from '@/components/common/Button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useReportStore } from '@/store/reportStore';
import { getCurrentLocation } from '@/services/location';
import { colors } from '@/theme/colors';
import { useAuthStore } from '@/store/authStore';

type ReportType = 'overflow_bin' | 'illegal_dumping';

const BG      = '#0b1a14';
const GREEN   = '#1a7a5e';
const ACCENT  = '#00e5a0';
const SURFACE = '#112018';
const BORDER  = '#1e3328';

export default function CitizenReportScreen() {
  const router = useRouter();
  const { submitReport, submitGuestReport, isSubmitting } = useReportStore();
  const { user } = useAuthStore();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const [photo, setPhoto] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>('overflow_bin');
  const [description, setDescription] = useState('');
  const [postPublic, setPostPublic] = useState(true);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');

  useEffect(() => { fetchLocation(); }, []);

  async function fetchLocation() {
    setLocationLoading(true);
    setLocationError('');
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Could not get location');
    } finally {
      setLocationLoading(false);
    }
  }

  async function handleCapture() {
    if (!cameraRef.current || !cameraReady) return;
    try {
      const result = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false });
      if (result?.uri) setPhoto(result.uri);
    } catch {
      Alert.alert('Error', 'Could not take photo. Please try again.');
    }
  }

  async function handleSubmit() {
    if (!photo) {
      Alert.alert('Photo Required', 'Please take a photo of the waste issue.');
      return;
    }
    if (!location) {
      Alert.alert('Location Required', 'We need your location to file this report.');
      return;
    }
    try {
      const payload = {
        type: reportType,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        description: description.trim() || undefined,
        photo,
      };
      if (user) {
        await submitReport(payload);
      } else {
        await submitGuestReport(payload);
      }
      Alert.alert('Report Submitted', 'Thank you! Your report has been received.', [
        { text: 'OK', onPress: () => router.replace('/(citizen)/tabs/my-reports') },
      ]);
    } catch (err) {
      Alert.alert('Submission Failed', err instanceof Error ? err.message : 'Could not submit report.');
    }
  }

  if (!permission) return <LoadingSpinner fullScreen />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.permWrap}>
          <View style={styles.permIconBox}>
            <Ionicons name="camera-outline" size={40} color={ACCENT} />
          </View>
          <Text style={styles.permTitle}>Camera Access Needed</Text>
          <Text style={styles.permSub}>
            CleanLoop needs camera access to capture waste reports.
          </Text>
          <Button title="Grant Camera Access" onPress={requestPermission} style={styles.permBtn} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── ANTI-FRAUD BANNER ── */}
        <View style={styles.fraudBanner}>
          <View style={styles.fraudIconWrap}>
            <Ionicons name="shield-checkmark" size={18} color={ACCENT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fraudTitle}>Anti-Fraud Protection Active</Text>
            <Text style={styles.fraudSub}>
              Live camera only — gallery uploads disabled to ensure real-time accuracy and location tagging.
            </Text>
          </View>
        </View>

        {/* ── CAMERA ── */}
        <View style={styles.cameraWrapper}>
          {photo ? (
            <>
              <Image source={{ uri: photo }} style={styles.camera} />
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => { setPhoto(null); setCameraReady(false); }}
              >
                <Ionicons name="refresh" size={15} color="#fff" />
                <Text style={styles.retakeBtnText}>Retake</Text>
              </TouchableOpacity>
            </>
          ) : (
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
              onCameraReady={() => setCameraReady(true)}
            >
              {/* Top bar */}
              <View style={styles.camTopBar}>
                <View style={styles.camPill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.camPillText}>LIVE</Text>
                </View>
                <View style={styles.camPill}>
                  <Text style={styles.camPillText}>60 FPS</Text>
                </View>
                <View style={{ flex: 1 }} />
              </View>

              {/* Corner brackets + crosshair */}
              <View style={styles.cameraOverlay}>
                <View style={styles.cornerTL} />
                <View style={styles.cornerTR} />
                <View style={styles.crossH} />
                <View style={styles.crossV} />
                <View style={styles.cornerBL} />
                <View style={styles.cornerBR} />
              </View>

              {/* Horizon */}
              <View style={styles.horizonRow}>
                <Text style={styles.horizonText}>⊕  HORIZON 0.0° LEVELED</Text>
              </View>

              {/* Detection / GPS row */}
              <View style={styles.detectionRow}>
                <Text style={styles.detectionTitle}>Waste report photo</Text>
                {location ? (
                  <View style={styles.gpsRow}>
                    <Ionicons name="location" size={11} color={ACCENT} />
                    <Text style={styles.gpsText}>
                      GPS: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                    </Text>
                  </View>
                ) : locationLoading ? (
                  <View style={styles.gpsRow}>
                    <Ionicons name="location-outline" size={11} color="#888" />
                    <Text style={[styles.gpsText, { color: '#888' }]}>Acquiring GPS lock...</Text>
                  </View>
                ) : null}
              </View>

              {/* Bottom capture bar */}
              <View style={styles.camBottomBar}>
                <View style={styles.camBottomAction}>
                  <Ionicons name="grid-outline" size={20} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.camBottomLabel}>Grid</Text>
                </View>
                <TouchableOpacity
                  style={[styles.captureBtn, !cameraReady && styles.captureBtnDisabled]}
                  onPress={handleCapture}
                  activeOpacity={0.85}
                  disabled={!cameraReady}
                >
                  <View style={styles.captureBtnRing}>
                    <View style={styles.captureBtnInner} />
                  </View>
                </TouchableOpacity>
                <View style={styles.camBottomAction}>
                  <Ionicons name="navigate" size={20} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.camBottomLabel}>GPS Sync</Text>
                </View>
              </View>
            </CameraView>
          )}
        </View>

        {/* ── FORM BODY ── */}
        <View style={styles.formBody}>

          {/* CLASSIFICATION */}
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <View style={styles.blockDot} />
              <Text style={styles.blockLabel}>Report Type</Text>
            </View>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeCard, reportType === 'overflow_bin' && styles.typeCardActive]}
                onPress={() => setReportType('overflow_bin')}
                activeOpacity={0.8}
              >
                <View style={[styles.typeIcon, reportType === 'overflow_bin' && styles.typeIconActive]}>
                  <Ionicons name="trash" size={18} color={reportType === 'overflow_bin' ? '#fff' : '#6b9e8a'} />
                </View>
                <Text style={[styles.typeLabel, reportType === 'overflow_bin' && styles.typeLabelActive]}>
                  Overflowing Bin
                </Text>
                {reportType === 'overflow_bin' && (
                  <View style={styles.typeCheck}>
                    <Ionicons name="checkmark" size={12} color={ACCENT} />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeCard, reportType === 'illegal_dumping' && styles.typeCardActive]}
                onPress={() => setReportType('illegal_dumping')}
                activeOpacity={0.8}
              >
                <View style={[styles.typeIcon, reportType === 'illegal_dumping' && styles.typeIconActive]}>
                  <Ionicons name="warning" size={18} color={reportType === 'illegal_dumping' ? '#fff' : '#b45309'} />
                </View>
                <Text style={[styles.typeLabel, reportType === 'illegal_dumping' && styles.typeLabelActive]}>
                  Illegal Dumping
                </Text>
                {reportType === 'illegal_dumping' && (
                  <View style={styles.typeCheck}>
                    <Ionicons name="checkmark" size={12} color={ACCENT} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* POST PUBLIC TOGGLE */}
          <View style={styles.block}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <View style={styles.toggleIconBox}>
                  <Ionicons name="earth" size={16} color={GREEN} />
                </View>
                <View>
                  <Text style={styles.toggleLabel}>Post to Public Feed</Text>
                  <Text style={styles.toggleSub}>Visible to crews and neighbours</Text>
                </View>
              </View>
              <Switch
                value={postPublic}
                onValueChange={setPostPublic}
                trackColor={{ false: '#2a3a34', true: GREEN }}
                thumbColor="#fff"
                style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
              />
            </View>
          </View>

          {/* DESCRIPTION */}
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <View style={styles.blockDot} />
              <Text style={styles.blockLabel}>Description</Text>
              <Text style={styles.blockOptional}>optional</Text>
            </View>
            <TextInput
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the issue..."
              placeholderTextColor="#3d5a4e"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* SUBMIT */}
          <View style={styles.submitWrap}>
            <Button
              title="Submit Report"
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={!photo || !location}
            />
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, paddingBottom: 40 },

  // Permission screen
  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36 },
  permIconBox: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  permTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 10, textAlign: 'center' },
  permSub:   { fontSize: 14, color: '#6b9e8a', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  permBtn:   { width: '80%' },

  // Anti-fraud banner
  fraudBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: SURFACE,
    borderBottomWidth: 1, borderBottomColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  fraudIconWrap: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: ACCENT + '18',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  fraudTitle: { fontSize: 13, fontWeight: '800', color: '#fff', marginBottom: 3 },
  fraudSub:   { fontSize: 12, color: '#6b9e8a', lineHeight: 17 },

  // Camera
  cameraWrapper: { height: 420, backgroundColor: '#000' },
  camera:        { width: '100%', height: '100%' },

  camTopBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8,
  },
  camPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  camPillText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  liveDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff4444' },

  cameraOverlay: { flex: 1, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  cornerTL: { position: 'absolute', top: 0, left: 20, width: 32, height: 32, borderTopWidth: 2, borderLeftWidth: 2, borderColor: ACCENT },
  cornerTR: { position: 'absolute', top: 0, right: 20, width: 32, height: 32, borderTopWidth: 2, borderRightWidth: 2, borderColor: ACCENT },
  cornerBL: { position: 'absolute', bottom: 0, left: 20, width: 32, height: 32, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: ACCENT },
  cornerBR: { position: 'absolute', bottom: 0, right: 20, width: 32, height: 32, borderBottomWidth: 2, borderRightWidth: 2, borderColor: ACCENT },
  crossH:   { position: 'absolute', width: 20, height: 1, backgroundColor: ACCENT, opacity: 0.8 },
  crossV:   { position: 'absolute', width: 1, height: 20, backgroundColor: ACCENT, opacity: 0.8 },

  horizonRow:     { alignItems: 'center', paddingBottom: 6 },
  horizonText:    { fontSize: 10, color: ACCENT, letterSpacing: 0.8, opacity: 0.75 },

  detectionRow:   { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.5)' },
  detectionTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 5 },
  gpsRow:         { flexDirection: 'row', alignItems: 'center', gap: 5 },
  gpsText:        { fontSize: 11, color: ACCENT },

  camBottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 30, paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  camBottomAction:     { alignItems: 'center', gap: 4, width: 56 },
  camBottomLabel:      { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  captureBtn:          { alignItems: 'center', justifyContent: 'center' },
  captureBtnDisabled:  { opacity: 0.4 },
  captureBtnRing: {
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 3, borderColor: GREEN,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(26,122,94,0.25)',
  },
  captureBtnInner: { width: 50, height: 50, borderRadius: 25, backgroundColor: GREEN },

  retakeBtn: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  retakeBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Form body
  formBody: { backgroundColor: BG, paddingTop: 6, paddingBottom: 16 },

  block: {
    marginHorizontal: 16, marginTop: 20,
    backgroundColor: SURFACE,
    borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    padding: 14,
  },

  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  blockDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT },
  blockLabel:  { fontSize: 13, fontWeight: '700', color: '#c8ddd6', letterSpacing: 0.2, flex: 1 },
  blockOptional: { fontSize: 11, color: '#3d5a4e', fontWeight: '600' },

  // Report type cards
  typeRow: { flexDirection: 'row', gap: 10 },
  typeCard: {
    flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10,
    borderRadius: 10, borderWidth: 1.5, borderColor: BORDER,
    backgroundColor: BG, gap: 8,
  },
  typeCardActive: { borderColor: GREEN, backgroundColor: GREEN + '18' },
  typeIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#1e3328',
    alignItems: 'center', justifyContent: 'center',
  },
  typeIconActive: { backgroundColor: GREEN },
  typeLabel:      { fontSize: 12, fontWeight: '600', color: '#6b9e8a', textAlign: 'center' },
  typeLabelActive: { color: '#fff' },
  typeCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: GREEN + '33',
    alignItems: 'center', justifyContent: 'center',
  },

  // Toggle
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggleIconBox: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: GREEN + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  toggleLabel: { fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 2 },
  toggleSub:   { fontSize: 11, color: '#4d7a6a' },

  // Description
  textArea: {
    backgroundColor: BG, borderRadius: 10,
    borderWidth: 1.5, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#fff', minHeight: 90,
  },

  // Submit
  submitWrap: { marginHorizontal: 16, marginTop: 24 },
});