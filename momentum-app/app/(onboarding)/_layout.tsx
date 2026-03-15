import React from 'react';
import { Stack } from 'expo-router';

/**
 * Onboarding group layout — headerless stack for multi-step onboarding.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
