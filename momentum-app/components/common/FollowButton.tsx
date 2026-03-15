import React, { useState, useCallback, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFollow, useUnfollow } from '@/hooks/useFollow';
import { colors, spacing, typography } from '@/constants/theme';

// ── Types ────────────────────────────────────────────────────────────────────

interface FollowButtonProps {
  username: string;
  initialIsFollowing: boolean;
  /** Compact style for inline use (e.g., search results) */
  compact?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FollowButton({
  username,
  initialIsFollowing,
  compact = false,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);

  const follow = useFollow();
  const unfollow = useUnfollow();

  const isPending = follow.isPending || unfollow.isPending;

  // Sync with prop changes
  useEffect(() => {
    setIsFollowing(initialIsFollowing);
  }, [initialIsFollowing]);

  const handlePress = useCallback(() => {
    const prev = isFollowing;

    // Optimistic toggle
    setIsFollowing(!prev);

    const mutation = prev ? unfollow : follow;

    mutation.mutate(username, {
      onError: () => {
        // Rollback on error
        setIsFollowing(prev);
      },
    });
  }, [isFollowing, username, follow, unfollow]);

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isFollowing ? styles.buttonFollowing : styles.buttonFollow,
        compact && styles.buttonCompact,
      ]}
      onPress={handlePress}
      disabled={isPending}
      activeOpacity={0.7}
      accessibilityLabel={isFollowing ? `Unfollow ${username}` : `Follow ${username}`}
      accessibilityRole="button"
    >
      {isPending ? (
        <ActivityIndicator
          size="small"
          color={isFollowing ? colors.textSecondary : colors.background}
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isFollowing ? styles.textFollowing : styles.textFollow,
            compact && styles.textCompact,
          ]}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  buttonCompact: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minWidth: 80,
  },
  buttonFollow: {
    backgroundColor: colors.primary,
  },
  buttonFollowing: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: {
    ...typography.body,
    fontWeight: '600',
  },
  textFollow: {
    color: colors.background,
  },
  textFollowing: {
    color: colors.textSecondary,
  },
  textCompact: {
    fontSize: 13,
  },
});
