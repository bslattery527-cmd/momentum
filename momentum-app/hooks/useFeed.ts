import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { FeedItem, PaginationMeta, Log, Streak, Goal, Category } from '@/types';

interface FeedResponse {
  data: FeedItem[];
  meta: PaginationMeta;
}

/**
 * Hook for the home feed (published logs from followed users).
 * Uses cursor-based infinite scrolling.
 */
export function useHomeFeed() {
  return useInfiniteQuery({
    queryKey: ['feed', 'home'],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const params: Record<string, string> = { limit: '20' };
      if (pageParam) {
        params.cursor = pageParam;
      }
      // Paginated responses (with meta) are NOT unwrapped by the interceptor
      const response = await api.get('/feed', { params });
      return response.data as FeedResponse;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.meta?.has_more && lastPage.meta.cursor) {
        return lastPage.meta.cursor;
      }
      return undefined;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Hook for the explore feed (public logs from non-followed users).
 * Uses cursor-based infinite scrolling.
 */
export function useExploreFeed() {
  return useInfiniteQuery({
    queryKey: ['feed', 'explore'],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const params: Record<string, string> = { limit: '20' };
      if (pageParam) {
        params.cursor = pageParam;
      }
      const response = await api.get('/feed/explore', { params });
      return response.data as FeedResponse;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.meta?.has_more && lastPage.meta.cursor) {
        return lastPage.meta.cursor;
      }
      return undefined;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Hook for a single log detail.
 */
export function useLogDetail(logId: string) {
  return useQuery({
    queryKey: ['logs', logId],
    queryFn: async () => {
      const response = await api.get(`/logs/${logId}`);
      return response.data as Log;
    },
    enabled: !!logId,
  });
}

/**
 * Hook for user logs (own or public profile).
 */
export function useUserLogs(username: string, own: boolean = false) {
  return useInfiniteQuery({
    queryKey: ['logs', username, own ? 'own' : 'public'],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const endpoint = own ? '/users/me/logs' : `/users/${username}/logs`;
      const params: Record<string, string> = { limit: '20' };
      if (pageParam) {
        params.cursor = pageParam;
      }
      const response = await api.get(endpoint, { params });
      return response.data as { data: Log[]; meta: PaginationMeta };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.meta?.has_more && lastPage.meta.cursor) {
        return lastPage.meta.cursor;
      }
      return undefined;
    },
    enabled: !!username,
  });
}

/**
 * Hook for current user streak data.
 */
export function useStreak() {
  return useQuery({
    queryKey: ['streak'],
    queryFn: async () => {
      const response = await api.get('/users/me/streak');
      return response.data as Streak;
    },
  });
}

/**
 * Hook for current weekly goal.
 */
export function useCurrentGoal() {
  return useQuery({
    queryKey: ['goal', 'current'],
    queryFn: async () => {
      const response = await api.get('/users/me/goals/current');
      return response.data as Goal;
    },
  });
}

/**
 * Hook for fetching categories (rarely changes, long stale time).
 */
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get('/categories');
      return response.data as Category[];
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}
