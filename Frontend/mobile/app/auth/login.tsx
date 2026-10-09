import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';

const FOREST = '#0f3d2e';
const MINT = '#d9f2e3';

interface FieldProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (t: string) => void;
  error?: string;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoComplete?: 'email' | 'password';
  returnKeyType?: 'next' | 'go';
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput | null>;
}

function Field({
  label, icon, value, onChangeText, error, placeholder, secure,
  keyboardType = 'default', autoComplete, returnKeyType, onSubmitEditing, inputRef,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.fieldBox,
          focused && styles.fieldBoxFocused,
          !!error && styles.fieldBoxError,
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={error ? colors.danger : focused ? colors.primary : colors.gray[500]}
        />
        <TextInput
          ref={inputRef as React.RefObject<TextInput>}
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.gray[500]}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secure && (
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.gray[500]} />
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, loginWithGoogle, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const passwordRef = useRef<TextInput>(null);

  function validate(): boolean {
    let valid = true;
    setEmailError('');
    setPasswordError('');
    if (!email.trim()) {
      setEmailError('Enter your email address');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Enter a valid email address');
      valid = false;
    }
    if (!password) {
      setPasswordError('Enter your password');
      valid = false;
    }
    return valid;
  }

  async function handleLogin() {
    if (!validate()) return;
    clearError();
    try {
      await login(email.trim().toLowerCase(), password);
      // Navigation handled by _layout.tsx AuthGate
    } catch {
      // error shown via store.error
    }
  }

  async function handleGoogle() {
    try {
      await loginWithGoogle();
    } catch {
      // Error is shown in the shared sign-in banner.
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <StatusBar barStyle="light-content" backgroundColor={FOREST} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: concentric rings echo the "loop" in CleanLoop */}
        <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
          <View style={[styles.ring, styles.ringLarge]} />
          <View style={[styles.ring, styles.ringMedium]} />
          <View style={[styles.ring, styles.ringSmall]} />

          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <Ionicons name="leaf" size={20} color={FOREST} />
            </View>
            <Text style={styles.brandName}>CleanLoop</Text>
          </View>

          <Text style={styles.heroTitle}>Welcome back</Text>
          <Text style={styles.heroSub}>
            Sign in to report waste and follow it until it is cleaned up.
          </Text>
        </View>

        {/* Form sheet */}
        <View style={styles.sheet}>
          {!!error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          <Field
            label="Email"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            error={emailError}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Field
            label="Password"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secure
            autoComplete="password"
            error={passwordError}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
            inputRef={passwordRef}
          />

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Sign in</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.googleButton} onPress={handleGoogle} activeOpacity={0.85}>
            <View style={styles.googleBadge}>
              <Text style={styles.googleBadgeText}>G</Text>
            </View>
            <Text style={styles.googleText}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to CleanLoop? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/register')}>
              <Text style={styles.footerLink}>Create an account</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.guestButton}
            onPress={() => router.replace('/(guest)')}
            activeOpacity={0.7}
          >
            <Ionicons name="eye-outline" size={18} color={FOREST} />
            <Text style={styles.guestText}>Browse as a guest</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FOREST,
  },
  scroll: {
    flexGrow: 1,
  },

  // ---- hero ----
  hero: {
    backgroundColor: FOREST,
    paddingHorizontal: 24,
    paddingBottom: 56,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderColor: 'rgba(217, 242, 227, 0.14)',
  },
  ringLarge: { width: 300, height: 300, borderWidth: 1.5, top: -90, right: -110 },
  ringMedium: { width: 200, height: 200, borderWidth: 1.5, top: -40, right: -60 },
  ringSmall: { width: 100, height: 100, borderWidth: 12, top: 10, right: -10, borderColor: 'rgba(34, 197, 94, 0.28)' },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 36,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: MINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.3,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 15,
    lineHeight: 22,
    color: MINT,
    maxWidth: 300,
  },

  // ---- sheet ----
  sheet: {
    flex: 1,
    marginTop: -28,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
  },

  // ---- fields ----
  fieldWrap: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray[700],
    marginBottom: 8,
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 54,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    backgroundColor: '#f8faf9',
  },
  fieldBoxFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  fieldBoxError: {
    borderColor: colors.danger,
    backgroundColor: '#fff7f7',
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    color: colors.gray[900],
    paddingVertical: 0,
  },
  fieldError: {
    marginTop: 6,
    fontSize: 12.5,
    color: colors.danger,
  },

  // ---- buttons ----
  primaryButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: FOREST,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray[200],
  },
  dividerText: {
    marginHorizontal: 14,
    fontSize: 13,
    color: colors.gray[500],
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    backgroundColor: colors.white,
  },
  googleBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#eef3fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBadgeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4285f4',
  },
  googleText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray[700],
  },

  // ---- footer ----
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 26,
  },
  footerText: {
    fontSize: 14,
    color: colors.gray[500],
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: MINT,
  },
  guestText: {
    fontSize: 14,
    fontWeight: '600',
    color: FOREST,
  },
});
