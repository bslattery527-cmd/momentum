import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StreakWidget } from '../StreakWidget';

describe('StreakWidget', () => {
  it('shows the zero-state motivation copy', () => {
    render(<StreakWidget currentStreak={0} longestStreak={5} />);

    expect(screen.getByText('Log a session today to start a new streak!')).toBeTruthy();
  });

  it('shows new-record encouragement when the current streak matches the best run', () => {
    render(<StreakWidget currentStreak={4} longestStreak={4} />);

    expect(screen.getByText('New personal best! Keep it going!')).toBeTruthy();
  });

  it('shows the countdown copy when chasing a longer streak', () => {
    render(<StreakWidget currentStreak={2} longestStreak={5} />);

    expect(screen.getByText('3 more days to beat your record!')).toBeTruthy();
  });
});
