import { create } from 'zustand';
import { saveRefreshToken, getRefreshToken, deleteRefreshToken } from '@/lib/auth';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;

  // Actions
  login: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  setToken: (accessToken: string) => void;
  setOnboardingComplete: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  hasCompletedOnboarding: false,

  login: async (user, accessToken, refreshToken) => {
    // Save refresh token to SecureStore; access token stays in memory only
    await saveRefreshToken(refreshToken);

    // Determine if user has completed onboarding (has display name and at least a username)
    const hasOnboarded = Boolean(user.display_name && user.bio !== null);

    set({
      user,
      accessToken,
      isAuthenticated: true,
      isLoading: false,
      hasCompletedOnboarding: hasOnboarded,
    });
  },

  logout: async () => {
    await deleteRefreshToken();
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      hasCompletedOnboarding: false,
    });
  },

  setUser: (user) => {
    set({ user });
  },

  setToken: (accessToken) => {
    set({ accessToken });
  },

  setOnboardingComplete: () => {
    set({ hasCompletedOnboarding: true });
  },

  hydrate: async () => {
    try {
      const refreshToken = await getRefreshToken();

      if (!refreshToken) {
        set({ isLoading: false });
        return;
      }

      // Attempt silent token refresh
      // Import api dynamically to avoid circular dependencies
      const { api } = await import('@/lib/api');
      const refreshResponse = await api.post('/auth/refresh', {
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token: newRefreshToken } = refreshResponse.data;

      // Store new tokens
      await saveRefreshToken(newRefreshToken);
      set({ accessToken: access_token });

      // Fetch the user profile (the refresh endpoint does not return user data)
      const userResponse = await api.get('/users/me');
      const user = userResponse.data;

      const hasOnboarded = Boolean(user.display_name && user.bio !== null);

      set({
        user,
        accessToken: access_token,
        isAuthenticated: true,
        isLoading: false,
        hasCompletedOnboarding: hasOnboarded,
      });
    } catch {
      // Refresh failed — user needs to re-authenticate
      await deleteRefreshToken();
      set({ isLoading: false });
    }
  },
}));
