import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { User } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface SearchResponse {
  data: User[];
}

// ── Query Keys ───────────────────────────────────────────────────────────────

export const searchKeys = {
  users: (query: string) => ['search', 'users', query] as const,
};

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Search for users by display name or username.
 * Only fires when query is >= 2 characters.
 * The calling component should debounce the query input (300ms recommended).
 */
export function useUserSearch(query: string) {
  const trimmed = query.trim();

  return useQuery<User[]>({
    queryKey: searchKeys.users(trimmed),
    queryFn: async () => {
      const response = await api.get('/users/search', {
        params: { q: trimmed },
      });
      return response.data as User[];
    },
    enabled: trimmed.length >= 2,
    staleTime: 30_000, // Cache search results for 30s
    placeholderData: (previousData) => previousData, // Keep previous results while typing
  });
}
