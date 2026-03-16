import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FeedCard } from '../FeedCard';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: mockPush,
  },
}));

const item = {
  id: 'log-1',
  user_id: 'user-1',
  title: 'Deep work session',
  note: 'Wrapped up the login bug.',
  total_duration: 3600,
  published_at: '2026-03-16T12:00:00.000Z',
  created_at: '2026-03-16T12:00:00.000Z',
  streak_at_time: 3,
  reaction_count: 4,
  comment_count: 2,
  has_reacted: false,
  images: [],
  tasks: [],
  tagged_users: [],
  user: {
    id: 'user-1',
    username: 'alex',
    display_name: 'Alex Perez',
    avatar_url: null,
  },
} as any;

describe('FeedCard', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('renders a visible clap affordance and calls onCelebrate', () => {
    const onCelebrate = jest.fn();

    render(<FeedCard item={item} onCelebrate={onCelebrate} />);

    expect(screen.getByText('Clap')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Celebrate Deep work session'));

    expect(onCelebrate).toHaveBeenCalledWith('log-1', false);
  });
});
