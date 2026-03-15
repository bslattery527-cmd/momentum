import { Platform } from 'react-native';

const REFRESH_TOKEN_KEY = 'momentum_refresh_token';

// Web fallback using localStorage since SecureStore is not available on web
const webStorage = {
  async setItemAsync(key: string, value: string) {
    localStorage.setItem(key, value);
  },
  async getItemAsync(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  },
  async deleteItemAsync(key: string) {
    localStorage.removeItem(key);
  },
};

async function getStore() {
  if (Platform.OS === 'web') {
    return webStorage;
  }
  return await import('expo-secure-store');
}

/**
 * Store refresh token securely on device.
 * On iOS this uses the Keychain; on Android, the Android Keystore.
 * On web, falls back to localStorage.
 * Access tokens are NEVER persisted — they live only in Zustand memory.
 */
export async function saveRefreshToken(token: string): Promise<void> {
  const store = await getStore();
  await store.setItemAsync(REFRESH_TOKEN_KEY, token);
}

/**
 * Retrieve the stored refresh token for silent re-auth on app launch.
 */
export async function getRefreshToken(): Promise<string | null> {
  const store = await getStore();
  return store.getItemAsync(REFRESH_TOKEN_KEY);
}

/**
 * Remove the refresh token on logout.
 */
export async function deleteRefreshToken(): Promise<void> {
  const store = await getStore();
  await store.deleteItemAsync(REFRESH_TOKEN_KEY);
}
