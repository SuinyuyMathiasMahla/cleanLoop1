import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  TextInput,
  TextInputProps,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
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
  keyboardType?: TextInputProps['keyboardType'];
  autoComplete?: TextInputProps['autoComplete'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput | null>;
}

function Field({
  label,
  icon,
  value,
  onChangeText,
  error,
  placeholder,
  secure,
  keyboardType = 'default',
  autoComplete,
  autoCapitalize = 'none',
  returnKeyType,
  onSubmitEditing,
  inputRef,
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
          color={
            error
              ? colors.danger
              : focused
              ? colors.primary
              : colors.gray[500]
          }
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
          autoCapitalize={autoCapitalize}
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
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.gray[500]}
            />
          </TouchableOpacity>
        )}
      </View>

      {!!error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    register,
    loginWithGoogle,
    isLoading,
    error,
    clearError,
  } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const longEnough = password.length >= 8;
  const matches =
    confirmPassword.length > 0 && password === confirmPassword;

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Enter your full name';
    }

    if (!email.trim()) {
      newErrors.email = 'Enter your email address';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Enter a valid email address';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Enter your phone number';
    } else if (!/^\+?[\d\s\-()]{8,}$/.test(phone)) {
      newErrors.phone =
        'Include your country code, for example +237 6XX XXX XXX';
    }

    if (!password) {
      newErrors.password = 'Choose a password';
    } else if (password.length < 8) {
      newErrors.password = 'Use at least 8 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;

    clearError();

    try {
      await register(
        email.trim().toLowerCase(),
        password,
        name.trim(),
        phone.trim()
      );

      router.push('/auth/verify');
    } catch {
      // error shown via store.error
    }
  }

  async function handleGoogle() {
    // Errors are stored in the auth store and shown in the banner below.
    await loginWithGoogle();
  }

  return (
    <>
      {/* Hide the default Expo Router header */}
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor={FOREST}
        />

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Compact hero */}
          <View
            style={[
              styles.hero,
              { paddingTop: insets.top + 12 },
            ]}
          >
            <View style={[styles.ring, styles.ringLarge]} />
            <View style={[styles.ring, styles.ringMedium]} />
            <View style={[styles.ring, styles.ringSmall]} />

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              accessibilityLabel="Go back"
              activeOpacity={0.8}
            >
              <Ionicons
                name="arrow-back"
                size={22}
                color={colors.white}
              />
            </TouchableOpacity>

            <Text style={styles.heroTitle}>
              Create your account
            </Text>

            <Text style={styles.heroSub}>
              Report overflowing bins and illegal dumping in your
              neighbourhood.
            </Text>
          </View>

          {/* Form sheet */}
          <View style={styles.sheet}>
            {!!error && (
              <View style={styles.errorBanner}>
                <Ionicons
                  name="alert-circle"
                  size={18}
                  color={colors.danger}
                />

                <Text style={styles.errorBannerText}>
                  {error}
                </Text>
              </View>
            )}

            <Field
              label="Full name"
              icon="person-outline"
              value={name}
              onChangeText={setName}
              placeholder="Jane Smith"
              autoCapitalize="words"
              autoComplete="name"
              error={errors.name}
              returnKeyType="next"
              onSubmitEditing={() =>
                emailRef.current?.focus()
              }
            />

            <Field
              label="Email"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              error={errors.email}
              returnKeyType="next"
              onSubmitEditing={() =>
                phoneRef.current?.focus()
              }
              inputRef={emailRef}
            />

            <Field
              label="Phone number"
              icon="call-outline"
              value={phone}
              onChangeText={setPhone}
              placeholder="+237 6XX XXX XXX"
              keyboardType="phone-pad"
              autoComplete="tel"
              error={errors.phone}
              returnKeyType="next"
              onSubmitEditing={() =>
                passwordRef.current?.focus()
              }
              inputRef={phoneRef}
            />

            <Field
              label="Password"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              secure
              autoComplete="password-new"
              error={errors.password}
              returnKeyType="next"
              onSubmitEditing={() =>
                confirmRef.current?.focus()
              }
              inputRef={passwordRef}
            />

            {/* Live password rule */}
            <View style={styles.ruleRow}>
              <Ionicons
                name={
                  longEnough
                    ? 'checkmark-circle'
                    : 'ellipse-outline'
                }
                size={16}
                color={
                  longEnough
                    ? colors.primary
                    : colors.gray[500]
                }
              />

              <Text
                style={[
                  styles.ruleText,
                  longEnough && styles.ruleTextMet,
                ]}
              >
                At least 8 characters
              </Text>
            </View>

            <Field
              label="Confirm password"
              icon="shield-checkmark-outline"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat your password"
              secure
              autoComplete="password-new"
              error={errors.confirmPassword}
              returnKeyType="go"
              onSubmitEditing={handleRegister}
              inputRef={confirmRef}
            />

            {matches && (
              <View
                style={[
                  styles.ruleRow,
                  styles.ruleRowAfterField,
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.primary}
                />

                <Text
                  style={[
                    styles.ruleText,
                    styles.ruleTextMet,
                  ]}
                >
                  Passwords match
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                isLoading &&
                  styles.primaryButtonDisabled,
              ]}
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Create account
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />

              <Text style={styles.dividerText}>or</Text>

              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogle}
              activeOpacity={0.85}
            >
              <View style={styles.googleBadge}>
                <Text style={styles.googleBadgeText}>
                  G
                </Text>
              </View>

              <Text style={styles.googleText}>
                Sign up with Google
              </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Already have an account?{' '}
              </Text>

              <TouchableOpacity
                onPress={() => router.back()}
              >
                <Text style={styles.footerLink}>
                  Sign in
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
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
    paddingBottom: 52,
    overflow: 'hidden',
  },

  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderColor: 'rgba(217, 242, 227, 0.14)',
  },

  ringLarge: {
    width: 280,
    height: 280,
    borderWidth: 1.5,
    top: -100,
    right: -110,
  },

  ringMedium: {
    width: 180,
    height: 180,
    borderWidth: 1.5,
    top: -50,
    right: -60,
  },

  ringSmall: {
    width: 90,
    height: 90,
    borderWidth: 11,
    top: 0,
    right: -8,
    borderColor: 'rgba(34, 197, 94, 0.28)',
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },

  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.7,
    marginBottom: 8,
  },

  heroSub: {
    fontSize: 15,
    lineHeight: 22,
    color: MINT,
    maxWidth: 320,
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

  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -8,
    marginBottom: 18,
  },

  ruleRowAfterField: {
    marginTop: -10,
  },

  ruleText: {
    fontSize: 13,
    color: colors.gray[500],
  },

  ruleTextMet: {
    color: colors.primary,
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
});