import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { queryClient } from '@/lib/queryClient';
import { deleteRefreshToken } from '@/lib/auth';
import { router } from 'expo-router';
import type {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  GoogleAuthPayload,
  AppleAuthPayload,
} from '@/types';

/**
 * Handle successful auth response — store tokens and user, then navigate.
 */
async function handleAuthSuccess(data: AuthResponse) {
  const { login } = useAuthStore.getState();
  await login(data.user, data.access_token, data.refresh_token);
}

/**
 * Hook for email/password login.
 */
export function useLogin() {
  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const response = await api.post<AuthResponse>('/auth/login', payload);
      return response.data;
    },
    onSuccess: async (data) => {
      await handleAuthSuccess(data as AuthResponse);
    },
  });
}

/**
 * Hook for email/password registration.
 */
export function useRegister() {
  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const response = await api.post<AuthResponse>('/auth/register', payload);
      return response.data;
    },
    onSuccess: async (data) => {
      await handleAuthSuccess(data as AuthResponse);
    },
  });
}

/**
 * Hook for Google OAuth authentication.
 */
export function useGoogleAuth() {
  return useMutation({
    mutationFn: async (payload: GoogleAuthPayload) => {
      const response = await api.post<AuthResponse>('/auth/google', payload);
      return response.data;
    },
    onSuccess: async (data) => {
      await handleAuthSuccess(data as AuthResponse);
    },
  });
}

/**
 * Hook for Apple Sign-In authentication.
 */
export function useAppleAuth() {
  return useMutation({
    mutationFn: async (payload: AppleAuthPayload) => {
      const response = await api.post<AuthResponse>('/auth/apple', payload);
      return response.data;
    },
    onSuccess: async (data) => {
      await handleAuthSuccess(data as AuthResponse);
    },
  });
}

/**
 * Hook for logging out.
 */
export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      try {
        await api.post('/auth/logout');
      } catch {
        // Best-effort — clear local state regardless
      }
    },
    onSettled: async () => {
      await useAuthStore.getState().logout();
      queryClient.clear();
      router.replace('/(auth)/welcome');
    },
  });
}
