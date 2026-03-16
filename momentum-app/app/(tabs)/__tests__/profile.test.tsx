import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {
      id: 'user-1',
      email: 'alex@example.com',
      display_name: 'Alex Perez',
      username: 'alex',
      avatar_url: null,
      bio: 'Building momentum.',
      follower_count: 4,
      following_count: 3,
      log_count: 9,
      created_at: '2026-03-16T00:00:00.000Z',
    },
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/hooks/useFeed', () => ({
  useUserLogs: () => ({
    data: { pages: [{ data: [], meta: { cursor: null, has_more: false } }] },
    isLoading: false,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: jest.fn(),
  }),
  useStreak: () => ({ data: { current_streak: 3, longest_streak: 8 }, refetch: jest.fn() }),
  useCurrentGoal: () => ({ data: null, refetch: jest.fn() }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useLogout: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: 'user-1',
      email: 'alex@example.com',
      display_name: 'Alex Perez',
      username: 'alex',
      avatar_url: null,
      bio: 'Building momentum.',
      created_at: '2026-03-16T00:00:00.000Z',
    },
  }),
}));

jest.mock('@/components/profile/StreakWidget', () => ({
  StreakWidget: () => null,
}));

jest.mock('@/components/profile/GoalWidget', () => ({
  GoalWidget: () => null,
}));

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));

import ProfileScreen from '../profile';

describe('ProfileScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('navigates to edit profile from the header action', () => {
    render(<ProfileScreen />);

    fireEvent.press(screen.getByLabelText('Edit profile'));

    expect(mockPush).toHaveBeenCalledWith('/edit-profile');
  });
});
