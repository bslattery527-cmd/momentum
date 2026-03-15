import {
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { User } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface PaginatedUsers {
  data: User[];
  meta: {
    cursor: string | null;
    has_more: boolean;
  };
}

// ── Query Keys ───────────────────────────────────────────────────────────────

export const followKeys = {
  followers: (username: string) => ['followers', username] as const,
  following: (username: string) => ['following', username] as const,
};

// ── Mutations ────────────────────────────────────────────────────────────────

export function useFollow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (username: string) => {
      await api.post(`/users/${username}/follow`);
      return username;
    },
    onMutate: async (username) => {
      // Cancel outgoing refetches for the user profile
      await queryClient.cancelQueries({ queryKey: ['profile', username] });

      // Snapshot the previous value
      const previousUser = queryClient.getQueryData(['profile', username]);

      // Optimistically update the user profile cache
      queryClient.setQueryData(['profile', username], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          is_following: true,
          follower_count: (old.follower_count ?? 0) + 1,
        };
      });

      return { previousUser, username };
    },
    onError: (_err, _username, context) => {
      // Rollback on error
      if (context?.previousUser) {
        queryClient.setQueryData(
          ['profile', context.username],
          context.previousUser,
        );
      }
    },
    onSettled: (_data, _err, username) => {
      // Refetch related queries
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({
        queryKey: followKeys.followers(username),
      });
    },
  });
}

export function useUnfollow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (username: string) => {
      await api.delete(`/users/${username}/follow`);
      return username;
    },
    onMutate: async (username) => {
      await queryClient.cancelQueries({ queryKey: ['profile', username] });

      const previousUser = queryClient.getQueryData(['profile', username]);

      queryClient.setQueryData(['profile', username], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          is_following: false,
          follower_count: Math.max(0, (old.follower_count ?? 1) - 1),
        };
      });

      return { previousUser, username };
    },
    onError: (_err, _username, context) => {
      if (context?.previousUser) {
        queryClient.setQueryData(
          ['profile', context.username],
          context.previousUser,
        );
      }
    },
    onSettled: (_data, _err, username) => {
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({
        queryKey: followKeys.followers(username),
      });
    },
  });
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useFollowers(username: string) {
  return useInfiniteQuery<PaginatedUsers>({
    queryKey: followKeys.followers(username),
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { limit: '20' };
      if (pageParam) params.cursor = pageParam as string;
      const response = await api.get(`/users/${username}/followers`, {
        params,
      });
      return response.data as unknown as PaginatedUsers;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.has_more ? lastPage.meta.cursor : undefined,
    enabled: !!username,
  });
}

export function useFollowing(username: string) {
  return useInfiniteQuery<PaginatedUsers>({
    queryKey: followKeys.following(username),
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { limit: '20' };
      if (pageParam) params.cursor = pageParam as string;
      const response = await api.get(`/users/${username}/following`, {
        params,
      });
      return response.data as unknown as PaginatedUsers;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.has_more ? lastPage.meta.cursor : undefined,
    enabled: !!username,
  });
}
