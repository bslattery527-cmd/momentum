import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { GoalWidget } from '../GoalWidget';

describe('GoalWidget', () => {
  it('renders the empty state CTA when no goal exists', () => {
    const onSetGoal = jest.fn();
    render(<GoalWidget goal={null} onSetGoal={onSetGoal} />);

    fireEvent.press(screen.getByText('Set a weekly goal'));

    expect(onSetGoal).toHaveBeenCalled();
    expect(screen.getByText('Track your progress and stay consistent')).toBeTruthy();
  });

  it('renders progress and completion messaging for a finished goal', () => {
    render(
      <GoalWidget
        goal={{
          id: 'goal-1',
          type: 'hours',
          target: 10,
          days_logged: 4,
          minutes_logged: 600,
          is_completed: true,
          created_at: '2026-03-15T10:00:00.000Z',
          week_start: '2026-03-09',
        } as any}
      />,
    );

    expect(screen.getByText('10 of 10 hours')).toBeTruthy();
    expect(screen.getByText('Done!')).toBeTruthy();
    expect(screen.getByText('Goal achieved! Great work this week.')).toBeTruthy();
  });
});
