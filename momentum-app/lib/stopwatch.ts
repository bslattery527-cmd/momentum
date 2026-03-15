import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = '@momentum/active_stopwatch';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ActiveSession {
  startedAt: number; // Unix timestamp in milliseconds
}

// ── Persistence ──────────────────────────────────────────────────────────────

/**
 * Start a new stopwatch session. Persists the start time to AsyncStorage
 * so it survives app kills.
 * Returns the start timestamp (ms).
 */
export async function startStopwatch(): Promise<number> {
  const startedAt = Date.now();
  const session: ActiveSession = { startedAt };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return startedAt;
}

/**
 * Stop the active stopwatch session.
 * Returns the elapsed time in seconds, or null if no session was active.
 * Clears the persisted session from AsyncStorage.
 */
export async function stopStopwatch(): Promise<{
  elapsedSeconds: number;
  startedAt: number;
  endedAt: number;
} | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  const session: ActiveSession = JSON.parse(raw);
  const endedAt = Date.now();
  const elapsedSeconds = Math.floor((endedAt - session.startedAt) / 1000);

  await AsyncStorage.removeItem(STORAGE_KEY);

  return {
    elapsedSeconds,
    startedAt: session.startedAt,
    endedAt,
  };
}

/**
 * Check if there is an active stopwatch session (e.g., after app restart).
 * Returns the session data or null.
 */
export async function getActiveSession(): Promise<ActiveSession | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ActiveSession;
  } catch {
    // Corrupted data — clear it
    await AsyncStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Get current elapsed seconds for an active session without stopping it.
 * Returns 0 if no session is active.
 */
export async function getElapsedSeconds(): Promise<number> {
  const session = await getActiveSession();
  if (!session) return 0;
  return Math.floor((Date.now() - session.startedAt) / 1000);
}

/**
 * Cancel and discard the active session without returning elapsed time.
 */
export async function cancelStopwatch(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// ── Formatting ───────────────────────────────────────────────────────────────

/**
 * Format elapsed seconds as HH:MM:SS.
 */
export function formatElapsed(totalSeconds: number): string {
  const absSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const seconds = absSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format duration in seconds to a human-readable string like "1h 30m".
 */
export function formatDuration(totalSeconds: number): string {
  const absSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);

  if (hours === 0 && minutes === 0) return '< 1m';
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
