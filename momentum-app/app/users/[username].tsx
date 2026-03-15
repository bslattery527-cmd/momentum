import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Layout,
} from '@/constants/theme';
import { useUserLogs } from '@/hooks/useFeed';
import { StreakWidget } from '@/components/profile/StreakWidget';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import type { PublicUser, Log } from '@/types';

/**
 * Format duration in seconds to human-readable string.
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
}

function timeAgo(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return 'just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();

  const {
    data: profile,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['profile', username],
    queryFn: async () => {
      const response = await api.get(`/users/${username}`);
      return response.data as PublicUser;
    },
    enabled: !!username,
  });

  const {
    data: logsData,
    isLoading: logsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchLogs,
  } = useUserLogs(username || '', false);

  const logs: Log[] = logsData?.pages.flatMap((page) => page.data) || [];

  // ─── Follow Mutation ──────────────────────────────────────────────

  const followMutation = useMutation({
    mutationFn: async (isFollowing: boolean) => {
      if (isFollowing) {
        await api.delete(`/users/${username}/follow`);
      } else {
        await api.post(`/users/${username}/follow`);
      }
    },
    onMutate: async (isFollowing) => {
      await queryClient.cancelQueries({ queryKey: ['profile', username] });
      const previous = queryClient.getQueryData(['profile', username]);

      queryClient.setQueryData(['profile', username], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          is_following: !isFollowing,
          follower_count: old.follower_count + (isFollowing ? -1 : 1),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['profile', username], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
    },
  });

  const handleRefresh = useCallback(() => {
    refetchProfile();
    refetchLogs();
  }, [refetchProfile, refetchLogs]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleLogPress = useCallback((logId: string) => {
    router.push(`/logs/${logId}`);
  }, []);

  // ─── Profile Header ───────────────────────────────────────────────

  const renderHeader = useCallback(() => {
    if (!profile) return null;

    return (
      <View style={styles.headerContainer}>
        {/* Avatar + Stats */}
        <View style={styles.profileTopRow}>
          {profile.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {profile.display_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.log_count}</Text>
              <Text style={styles.statLabel}>Logs</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.follower_count}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.following_count}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
        </View>

        {/* Name & Bio */}
        <View style={styles.nameSection}>
          <Text style={styles.displayName}>{profile.display_name}</Text>
          <Text style={styles.username}>@{profile.username}</Text>
          {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        </View>

        {/* Follow Button */}
        <Pressable
          style={[
            styles.followButton,
            profile.is_following && styles.followingButton,
          ]}
          onPress={() => followMutation.mutate(!!profile.is_following)}
          disabled={followMutation.isPending}
        >
          {followMutation.isPending ? (
            <ActivityIndicator
              size="small"
              color={profile.is_following ? Colors.text : Colors.textInverse}
            />
          ) : (
            <Text
              style={[
                styles.followButtonText,
                profile.is_following && styles.followingButtonText,
              ]}
            >
              {profile.is_following ? 'Following' : 'Follow'}
            </Text>
          )}
        </Pressable>

        {/* Streak Widget */}
        <View style={styles.widgetsSection}>
          <StreakWidget
            currentStreak={profile.current_streak}
            longestStreak={profile.longest_streak}
          />
        </View>

        {/* Logs Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Published Sessions</Text>
        </View>
      </View>
    );
  }, [profile, followMutation]);

  // ─── Log Item ──────────────────────────────────────────────────────

  const renderLogItem = useCallback(
    ({ item }: { item: Log }) => (
      <Pressable
        style={styles.logItem}
        onPress={() => handleLogPress(item.id)}
      >
        <View style={styles.logHeader}>
          <Text style={styles.logTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.logTime}>{timeAgo(item.created_at)}</Text>
        </View>

        {item.note && (
          <Text style={styles.logNote} numberOfLines={2}>
            {item.note}
          </Text>
        )}

        <View style={styles.logFooter}>
          <View style={styles.durationRow}>
            <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.durationText}>
              {formatDuration(item.total_duration)}
            </Text>
          </View>

          <View style={styles.socialStats}>
            {item.reaction_count > 0 && (
              <View style={styles.miniStat}>
                <Ionicons name="heart" size={12} color={Colors.celebrate} />
                <Text style={styles.miniStatText}>{item.reaction_count}</Text>
              </View>
            )}
            {item.comment_count > 0 && (
              <View style={styles.miniStat}>
                <Ionicons name="chatbubble" size={12} color={Colors.textSecondary} />
                <Text style={styles.miniStatText}>{item.comment_count}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    ),
    [handleLogPress]
  );

  const renderEmpty = useCallback(() => {
    if (logsLoading) return null;
    return (
      <View style={styles.emptyLogs}>
        <Text style={styles.emptyLogsText}>No published sessions yet</Text>
      </View>
    );
  }, [logsLoading]);

  const renderFooter = useCallback(() => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.loadingFooter}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      );
    }
    return null;
  }, [isFetchingNextPage]);

  if (profileLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: profile?.display_name || username || '',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
      <View style={styles.container}>
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={renderLogItem}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingBottom: Spacing['6xl'],
  },
  headerContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: Layout.avatarSizeXl,
    height: Layout.avatarSizeXl,
    borderRadius: Layout.avatarSizeXl / 2,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginLeft: Spacing.xl,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...Typography.h4,
    color: Colors.text,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  nameSection: {
    marginTop: Spacing.lg,
  },
  displayName: {
    ...Typography.h4,
    color: Colors.text,
  },
  username: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  bio: {
    ...Typography.body,
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  followButton: {
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  followingButton: {
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  followButtonText: {
    ...Typography.buttonSmall,
    color: Colors.textInverse,
  },
  followingButtonText: {
    color: Colors.text,
  },
  widgetsSection: {
    marginTop: Spacing.xl,
  },
  sectionHeader: {
    marginTop: Spacing['2xl'],
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.text,
  },
  logItem: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logTitle: {
    ...Typography.bodySemibold,
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  logTime: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  logNote: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  logFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    ...Typography.small,
    color: Colors.textSecondary,
  },
  socialStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  miniStatText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  emptyLogs: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
  },
  emptyLogsText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  loadingFooter: {
    paddingVertical: Spacing.xl,
  },
});
