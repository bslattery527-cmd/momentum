import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '@/constants/theme';
import { useRegister } from '@/hooks/useAuth';

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

export default function RegisterScreen() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{
    displayName?: string;
    username?: string;
    email?: string;
    password?: string;
  }>({});

  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const registerMutation = useRegister();

  const validate = useCallback((): boolean => {
    const newErrors: typeof errors = {};

    if (!displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    } else if (displayName.trim().length < 2) {
      newErrors.displayName = 'Display name must be at least 2 characters';
    }

    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedUsername) {
      newErrors.username = 'Username is required';
    } else if (!USERNAME_REGEX.test(normalizedUsername)) {
      newErrors.username =
        'Username must be 3-30 characters: letters, numbers, underscores only';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [displayName, username, email, password]);

  const handleRegister = useCallback(() => {
    if (!validate()) return;

    registerMutation.mutate({
      display_name: displayName.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      password,
    });
  }, [displayName, username, email, password, validate, registerMutation]);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  const clearError = (field: keyof typeof errors) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const apiError = registerMutation.error as any;
  const serverMessage =
    apiError?.response?.data?.error?.message || apiError?.message;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── Header ────────────────────────────────────── */}
          <View style={styles.header}>
            <Pressable onPress={handleBack} hitSlop={12} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color={Colors.text} />
            </Pressable>
          </View>

          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>
            Join Momentum and start tracking your progress
          </Text>

          {/* ─── Server Error ──────────────────────────────── */}
          {registerMutation.isError && (
            <View style={styles.serverError}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.serverErrorText}>
                {serverMessage || 'Registration failed. Please try again.'}
              </Text>
            </View>
          )}

          {/* ─── Display Name ──────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Display name</Text>
            <View
              style={[
                styles.inputContainer,
                errors.displayName && styles.inputError,
              ]}
            >
              <TextInput
                style={styles.input}
                placeholder="Alex Chen"
                placeholderTextColor={Colors.textTertiary}
                value={displayName}
                onChangeText={(t) => {
                  setDisplayName(t);
                  clearError('displayName');
                }}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                onSubmitEditing={() => usernameRef.current?.focus()}
                editable={!registerMutation.isPending}
              />
            </View>
            {errors.displayName && (
              <Text style={styles.errorText}>{errors.displayName}</Text>
            )}
          </View>

          {/* ─── Username ──────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Username</Text>
            <View
              style={[
                styles.inputContainer,
                errors.username && styles.inputError,
              ]}
            >
              <Text style={styles.inputPrefix}>@</Text>
              <TextInput
                ref={usernameRef}
                style={[styles.input, styles.usernameInput]}
                placeholder="alex_chen"
                placeholderTextColor={Colors.textTertiary}
                value={username}
                onChangeText={(t) => {
                  setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                  clearError('username');
                }}
                autoCapitalize="none"
                autoComplete="username"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                editable={!registerMutation.isPending}
              />
            </View>
            {errors.username ? (
              <Text style={styles.errorText}>{errors.username}</Text>
            ) : (
              <Text style={styles.hintText}>
                Letters, numbers, underscores. 3-30 characters.
              </Text>
            )}
          </View>

          {/* ─── Email ─────────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <View
              style={[
                styles.inputContainer,
                errors.email && styles.inputError,
              ]}
            >
              <TextInput
                ref={emailRef}
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textTertiary}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  clearError('email');
                }}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!registerMutation.isPending}
              />
            </View>
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
          </View>

          {/* ─── Password ──────────────────────────────────── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View
              style={[
                styles.inputContainer,
                errors.password && styles.inputError,
              ]}
            >
              <TextInput
                ref={passwordRef}
                style={[styles.input, styles.passwordInput]}
                placeholder="At least 8 characters"
                placeholderTextColor={Colors.textTertiary}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  clearError('password');
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={handleRegister}
                editable={!registerMutation.isPending}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={8}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Colors.textTertiary}
                />
              </Pressable>
            </View>
            {errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}
          </View>

          {/* ─── Submit Button ──────────────────────────────── */}
          <Pressable
            style={[
              styles.submitButton,
              registerMutation.isPending && styles.submitButtonDisabled,
            ]}
            onPress={handleRegister}
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <Text style={styles.submitButtonText}>Create account</Text>
            )}
          </Pressable>

          {/* ─── Login Link ─────────────────────────────────── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Pressable
              onPress={() => router.replace('/(auth)/login')}
              hitSlop={8}
            >
              <Text style={styles.footerLink}>Log in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing['3xl'],
    paddingBottom: Spacing['3xl'],
  },
  header: {
    paddingTop: Spacing.sm,
    marginBottom: Spacing['2xl'],
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing.sm,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing['2xl'],
  },
  serverError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  serverErrorText: {
    ...Typography.small,
    color: Colors.error,
    flex: 1,
  },
  fieldGroup: {
    marginBottom: Spacing.xl,
  },
  label: {
    ...Typography.smallMedium,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundSecondary,
  },
  inputError: {
    borderColor: Colors.error,
  },
  inputPrefix: {
    ...Typography.body,
    color: Colors.textSecondary,
    paddingLeft: Spacing.lg,
  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: Spacing.lg,
    ...Typography.body,
    color: Colors.text,
  },
  usernameInput: {
    paddingLeft: Spacing.xs,
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: Spacing.md,
    padding: Spacing.xs,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  hintText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  submitButton: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    ...Typography.button,
    color: Colors.textInverse,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing['3xl'],
    gap: Spacing.xs,
  },
  footerText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  footerLink: {
    ...Typography.bodySemibold,
    color: Colors.primary,
  },
});
