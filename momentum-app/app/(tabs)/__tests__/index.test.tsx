import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@/hooks/useFeed', () => ({
  useHomeFeed: () => ({
    data: { pages: [{ data: [], meta: { cursor: null, has_more: false } }] },
    isLoading: false,
    isRefetching: false,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: jest.fn(),
  }),
  useCurrentGoal: () => ({ data: null }),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({
    mutate: jest.fn(),
  }),
}));

jest.mock('@/lib/queryClient', () => ({
  queryClient: {
    cancelQueries: jest.fn(),
    getQueryData: jest.fn(),
    setQueryData: jest.fn(),
    invalidateQueries: jest.fn(),
  },
}));

jest.mock('@/components/feed/FeedCard', () => ({
  FeedCard: () => null,
}));

jest.mock('@/components/profile/GoalModal', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockGoalModal({ visible }: { visible: boolean }) {
    return visible ? React.createElement(Text, null, 'Goal modal open') : null;
  };
});

import HomeScreen from '../index';

describe('HomeScreen', () => {
  it('opens the goal modal from the weekly goal CTA', () => {
    render(<HomeScreen />);

    fireEvent.press(screen.getByText('Set a weekly goal'));

    expect(screen.getByText('Goal modal open')).toBeTruthy();
  });
});
