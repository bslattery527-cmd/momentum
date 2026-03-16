import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '@/constants/theme';
import { useGoogleAuth, useAppleAuth } from '@/hooks/useAuth';

// Ensure browser session completes on web
WebBrowser.maybeCompleteAuthSession();

// Google OAuth discovery document
const googleDiscovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
const APPLE_SIGN_IN_ENABLED = process.env.EXPO_PUBLIC_ENABLE_APPLE_SIGN_IN !== '0';

function createNonce(): string {
  if (typeof globalThis !== 'undefined' && 'crypto' in globalThis) {
    if (typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }

    if (typeof globalThis.crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function WelcomeScreen() {
  const googleAuth = useGoogleAuth();
  const appleAuth = useAppleAuth();

  // ─── Google Sign-In ──────────────────────────────────────────────────────

  const handleGoogleSignIn = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) {
      Alert.alert('Not Configured', 'Google Sign-In is not configured yet. Use email sign-up instead.');
      return;
    }
    try {
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'momentum',
      });

      const request = new AuthSession.AuthRequest({
        clientId: GOOGLE_CLIENT_ID,
        scopes: ['openid', 'profile', 'email'],
        redirectUri,
        responseType: AuthSession.ResponseType.IdToken,
        usePKCE: false,
        extraParams: {
          nonce: createNonce(),
        },
      });

      const result = await request.promptAsync(googleDiscovery);

      if (result.type === 'success' && result.params.id_token) {
        googleAuth.mutate({ id_token: result.params.id_token });
      }
    } catch (error) {
      Alert.alert('Sign-in Error', 'Google sign-in failed. Please try again.');
    }
  }, [googleAuth]);

  // ─── Apple Sign-In ───────────────────────────────────────────────────────

  const handleAppleSignIn = useCallback(async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const displayName = credential.fullName
          ? [credential.fullName.givenName, credential.fullName.familyName]
              .filter(Boolean)
              .join(' ')
          : undefined;

        appleAuth.mutate({
          identity_token: credential.identityToken,
          display_name: displayName || undefined,
        });
      }
    } catch (error: any) {
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign-in Error', 'Apple sign-in failed. Please try again.');
      }
    }
  }, [appleAuth]);

  // ─── Email Navigation ────────────────────────────────────────────────────

  const handleEmailSignUp = useCallback(() => {
    router.push('/(auth)/register');
  }, []);

  const handleLogIn = useCallback(() => {
    router.push('/(auth)/login');
  }, []);

  const handleDemoMode = useCallback(async () => {
    const { useAuthStore } = await import('@/store/authStore');
    await useAuthStore.getState().login(
      {
        id: 'demo-user-id',
        email: 'demo@momentum.app',
        display_name: 'Demo User',
        username: 'demo_user',
        avatar_url: null,
        bio: 'Exploring Momentum in demo mode',
        goal_category: 'Coding',
        created_at: new Date().toISOString(),
      } as any,
      'demo-access-token',
      'demo-refresh-token',
    );
    // Ensure onboarding is marked complete so AuthGate routes to /(tabs)
    useAuthStore.setState({ hasCompletedOnboarding: true });
    router.replace('/(tabs)');
  }, []);

  const isLoading = googleAuth.isPending || appleAuth.isPending;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* ─── Logo & Tagline ──────────────────────────────── */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <Ionicons name="rocket" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>Momentum</Text>
          <Text style={styles.tagline}>
            Build habits through{'\n'}social accountability
          </Text>
        </View>

        {/* ─── Auth Buttons ────────────────────────────────── */}
        <View style={styles.buttonSection}>
          {/* Google Sign-In */}
          <Pressable
            style={[styles.socialButton, styles.googleButton]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
          >
            <Ionicons name="logo-google" size={20} color={Colors.textInverse} />
            <Text style={[styles.socialButtonText, styles.googleButtonText]}>
              Continue with Google
            </Text>
          </Pressable>

          {/* Apple Sign-In (iOS only) */}
          {Platform.OS === 'ios' && APPLE_SIGN_IN_ENABLED && (
            <Pressable
              style={[styles.socialButton, styles.appleButton]}
              onPress={handleAppleSignIn}
              disabled={isLoading}
            >
              <Ionicons name="logo-apple" size={20} color={Colors.textInverse} />
              <Text style={[styles.socialButtonText, styles.appleButtonText]}>
                Continue with Apple
              </Text>
            </Pressable>
          )}

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email Sign-Up */}
          <Pressable
            style={[styles.socialButton, styles.emailButton]}
            onPress={handleEmailSignUp}
            disabled={isLoading}
          >
            <Ionicons name="mail-outline" size={20} color={Colors.primary} />
            <Text style={[styles.socialButtonText, styles.emailButtonText]}>
              Sign up with email
            </Text>
          </Pressable>

          {/* Demo Mode (dev only) */}
          {__DEV__ && (
            <Pressable
              style={[styles.socialButton, styles.demoButton]}
              onPress={handleDemoMode}
              nativeID={Platform.OS === 'web' ? 'demo-mode-button' : undefined}
              testID="demo-mode-button"
              dataSet={Platform.OS === 'web' ? { testid: 'demo-mode-button' } : undefined}
              {...(Platform.OS === 'web' ? ({ id: 'demo-mode-button' } as any) : {})}
            >
              <Ionicons name="flask-outline" size={20} color={Colors.textSecondary} />
              <Text style={[styles.socialButtonText, styles.demoButtonText]}>
                Explore in Demo Mode
              </Text>
            </Pressable>
          )}
        </View>

        {/* ─── Log In Link ─────────────────────────────────── */}
        <View style={styles.footerSection}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Pressable onPress={handleLogIn} disabled={isLoading} hitSlop={8}>
            <Text style={styles.footerLink}>Log in</Text>
          </Pressable>
        </View>
      </View>

      {/* ─── Error Display ──────────────────────────────────── */}
      {(googleAuth.isError || appleAuth.isError) && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>
            {googleAuth.error?.message ||
              appleAuth.error?.message ||
              'Authentication failed. Please try again.'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing['3xl'],
    justifyContent: 'space-between',
  },
  heroSection: {
    alignItems: 'center',
    marginTop: Spacing['6xl'],
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  appName: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  tagline: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonSection: {
    gap: Spacing.md,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    ...Shadows.small,
  },
  googleButton: {
    backgroundColor: Colors.google,
  },
  appleButton: {
    backgroundColor: Colors.apple,
  },
  emailButton: {
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  socialButtonText: {
    ...Typography.button,
  },
  googleButtonText: {
    color: Colors.textInverse,
  },
  appleButtonText: {
    color: Colors.textInverse,
  },
  emailButtonText: {
    color: Colors.primary,
  },
  demoButton: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed' as any,
  },
  demoButtonText: {
    color: Colors.textSecondary,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  dividerText: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginHorizontal: Spacing.lg,
  },
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: Spacing['3xl'],
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
  errorBanner: {
    position: 'absolute',
    bottom: Spacing['5xl'],
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.errorLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  errorText: {
    ...Typography.small,
    color: Colors.error,
  },
});
