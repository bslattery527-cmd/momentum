import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, ActivityIndicator, View } from 'react-native';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import { Colors } from '@/constants/theme';

/**
 * Auth gate — redirects based on auth state.
 * Uses useSegments + useRouter to navigate imperatively,
 * which is the correct pattern for Expo Router auth flows.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, hasCompletedOnboarding, hydrate } =
    useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    if (!isAuthenticated && !inAuthGroup) {
      // Not signed in — redirect to welcome
      router.replace('/(auth)/welcome');
    } else if (isAuthenticated && !hasCompletedOnboarding && !inOnboardingGroup) {
      // Signed in but needs onboarding
      router.replace('/(onboarding)');
    } else if (isAuthenticated && hasCompletedOnboarding && (inAuthGroup || inOnboardingGroup)) {
      // Fully authenticated — go to main app
      router.replace('/(tabs)');
    }
  }, [isLoading, isAuthenticated, hasCompletedOnboarding, segments, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <StatusBar style="dark" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <Slot />
        </AuthGate>
        <StatusBar style="dark" />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
