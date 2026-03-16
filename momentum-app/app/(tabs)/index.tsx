import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import {
  Colors,
  Typography,
  Spacing,
} from '@/constants/theme';
import { useHomeFeed, useCurrentGoal } from '@/hooks/useFeed';
import { FeedCard } from '@/components/feed/FeedCard';
import { GoalWidget } from '@/components/profile/GoalWidget';
import GoalModal from '@/components/profile/GoalModal';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import type { FeedItem } from '@/types';

export default function HomeScreen() {
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const {
    data,
    isLoading,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useHomeFeed();

  const { data: currentGoal } = useCurrentGoal();

  // Flatten pages into a single array
  const feedItems: FeedItem[] =
    data?.pages.flatMap((page) => page.data) || [];

  // ─── Celebrate Mutation ──────────────────────────────────────────────

  const celebrateMutation = useMutation({
    mutationFn: async ({
      logId,
      hasReacted,
    }: {
      logId: string;
      hasReacted: boolean;
    }) => {
      if (hasReacted) {
        await api.delete(`/logs/${logId}/reactions`);
      } else {
        await api.post(`/logs/${logId}/reactions`);
      }
    },
    onMutate: async ({ logId, hasReacted }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['feed', 'home'] });

      // Snapshot previous data
      const previousFeed = queryClient.getQueryData(['feed', 'home']);

      // Optimistic update
      queryClient.setQueryData(['feed', 'home'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((item: FeedItem) =>
              item.id === logId
                ? {
                    ...item,
                    has_reacted: !hasReacted,
                    reaction_count: item.reaction_count + (hasReacted ? -1 : 1),
                  }
                : item
            ),
          })),
        };
      });

      return { previousFeed };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousFeed) {
        queryClient.setQueryData(['feed', 'home'], context.previousFeed);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed', 'home'] });
    },
  });

  const handleCelebrate = useCallback(
    (logId: string, hasReacted: boolean) => {
      celebrateMutation.mutate({ logId, hasReacted });
    },
    [celebrateMutation]
  );

  // ─── Load More ──────────────────────────────────────────────────────

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ─── Render Item ─────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => (
      <FeedCard item={item} onCelebrate={handleCelebrate} />
    ),
    [handleCelebrate]
  );

  const renderHeader = useCallback(
    () => (
      <View style={styles.headerContent}>
        <GoalWidget
          goal={currentGoal}
          compact
          onSetGoal={() => setGoalModalVisible(true)}
        />
      </View>
    ),
    [currentGoal]
  );

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

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons name="people-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.emptyTitle}>Your feed is empty</Text>
        <Text style={styles.emptySubtitle}>
          Follow people on the Explore tab to see their work sessions here
        </Text>
      </View>
    );
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={feedItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={() => refetch()}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      <GoalModal
        visible={goalModalVisible}
        onClose={() => setGoalModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
  },
  listContent: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing['6xl'],
  },
  headerContent: {
    marginBottom: Spacing.sm,
  },
  loadingFooter: {
    paddingVertical: Spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing['6xl'],
    paddingHorizontal: Spacing['3xl'],
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
