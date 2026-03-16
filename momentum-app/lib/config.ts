import { Platform } from 'react-native';

const REMOTE_API_BASE_URL = 'https://momentum-app-rav9.onrender.com/api/v1';

function getLocalApiBaseUrl(): string {
  const port = process.env.EXPO_PUBLIC_LOCAL_API_PORT || '3001';

  // For emulators/simulators, these defaults work out of the box.
  // For a physical phone, set EXPO_PUBLIC_LOCAL_API_HOST to your Mac's LAN IP.
  const defaultHost =
    Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

  const host = process.env.EXPO_PUBLIC_LOCAL_API_HOST || defaultHost;

  // iOS ATS will often block non-HTTPS on device; local mode is primarily for
  // simulator/emulator or when you explicitly set a reachable LAN host above.
  return `http://${host}:${port}/api/v1`;
}

/**
 * API base URL selection.
 *
 * - Default: Render (REMOTE_API_BASE_URL)
 * - Local override: set EXPO_PUBLIC_API_MODE=local (via npm script)
 * - Manual override: set EXPO_PUBLIC_API_URL explicitly
 */
export function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_MODE === 'local') {
    return getLocalApiBaseUrl();
  }

  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit;

  return REMOTE_API_BASE_URL;
}
