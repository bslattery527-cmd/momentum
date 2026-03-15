import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Goal, Streak } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface CreateGoalPayload {
  type: 'days' | 'hours';
  target: number;
}

// ── Query Keys ───────────────────────────────────────────────────────────────

export const goalKeys = {
  current: () => ['goal', 'current'] as const,
  streak: () => ['streak'] as const,
};

// ── Queries ──────────────────────────────────────────────────────────────────

export function useCurrentGoal() {
  return useQuery<Goal | null>({
    queryKey: goalKeys.current(),
    queryFn: async () => {
      try {
        const response = await api.get('/users/me/goals/current');
        return response.data as Goal;
      } catch (err: any) {
        // 404 means no active goal — this is expected
        if (err?.response?.status === 404) return null;
        throw err;
      }
    },
  });
}

export function useStreak() {
  return useQuery<Streak>({
    queryKey: goalKeys.streak(),
    queryFn: async () => {
      const response = await api.get('/users/me/streak');
      return response.data as Streak;
    },
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useCreateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateGoalPayload) => {
      const response = await api.post('/users/me/goals', payload);
      return response.data as Goal;
    },
    onSuccess: (data) => {
      // Update the current goal cache directly
      queryClient.setQueryData(goalKeys.current(), data);
    },
  });
}
