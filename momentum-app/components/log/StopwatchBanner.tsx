import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getActiveSession,
  stopStopwatch,
  formatElapsed,
  cancelStopwatch,
} from '@/lib/stopwatch';
import { colors, spacing, typography } from '@/constants/theme';

// ── Types ────────────────────────────────────────────────────────────────────

interface StopwatchBannerProps {
  /** Called when the user taps Stop — returns elapsed info for the log sheet */
  onStop: (result: {
    elapsedSeconds: number;
    startedAt: number;
    endedAt: number;
  }) => void;
  /** Called when the user discards the session */
  onDiscard?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function StopwatchBanner({
  onStop,
  onDiscard,
}: StopwatchBannerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [active, setActive] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Check for an active session on mount (e.g., after app restart)
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const init = async () => {
      const session = await getActiveSession();
      if (session) {
        startedAtRef.current = session.startedAt;
        setActive(true);

        // Update elapsed every second
        intervalId = setInterval(() => {
          if (startedAtRef.current) {
            const secs = Math.floor(
              (Date.now() - startedAtRef.current) / 1000,
            );
            setElapsed(secs);
          }
        }, 1000);
      }
    };

    init();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // Pulse animation for the recording dot
  useEffect(() => {
    if (!active) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();

    return () => animation.stop();
  }, [active, pulseAnim]);

  const handleStop = useCallback(async () => {
    const result = await stopStopwatch();
    if (result) {
      setActive(false);
      setElapsed(0);
      startedAtRef.current = null;
      onStop(result);
    }
  }, [onStop]);

  const handleDiscard = useCallback(async () => {
    await cancelStopwatch();
    setActive(false);
    setElapsed(0);
    startedAtRef.current = null;
    onDiscard?.();
  }, [onDiscard]);

  if (!active) return null;

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <Animated.View style={[styles.recordingDot, { opacity: pulseAnim }]} />
        <Text style={styles.timerText}>{formatElapsed(elapsed)}</Text>
        <Text style={styles.label}>Session in progress</Text>
      </View>

      <View style={styles.buttonGroup}>
        {onDiscard && (
          <TouchableOpacity
            style={styles.discardButton}
            onPress={handleDiscard}
            accessibilityLabel="Discard session"
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.stopButton}
          onPress={handleStop}
          accessibilityLabel="Stop session"
          accessibilityRole="button"
        >
          <Ionicons name="stop" size={16} color={colors.background} />
          <Text style={styles.stopButtonText}>Stop</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryDark ?? colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
  },
  timerText: {
    ...typography.subtitle,
    color: colors.background,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  label: {
    ...typography.caption,
    color: colors.background,
    opacity: 0.8,
    marginLeft: spacing.xs,
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  discardButton: {
    padding: spacing.xs,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    gap: 4,
  },
  stopButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
});
