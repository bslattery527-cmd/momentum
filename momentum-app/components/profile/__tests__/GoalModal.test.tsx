import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockMutateAsync = jest.fn();

jest.mock('@/hooks/useGoals', () => ({
  useCreateGoal: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

import GoalModal from '../GoalModal';

describe('GoalModal', () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

  beforeEach(() => {
    mockMutateAsync.mockReset();
    alertSpy.mockClear();
  });

  it('creates a weekly goal from the modal', async () => {
    const onClose = jest.fn();
    mockMutateAsync.mockResolvedValue({});

    render(<GoalModal visible onClose={onClose} />);

    fireEvent.press(screen.getByText('Save goal'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ type: 'days', target: 5 });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('validates the target before saving', async () => {
    render(<GoalModal visible onClose={jest.fn()} />);

    fireEvent.changeText(screen.getByDisplayValue('5'), '');
    fireEvent.press(screen.getByText('Save goal'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Invalid goal', 'Please enter a target greater than 0.');
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });
  });
});
