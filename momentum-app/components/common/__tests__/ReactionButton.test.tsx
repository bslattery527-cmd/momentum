import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ReactionButton from '../ReactionButton';

const mockMutate = jest.fn();

jest.mock('@/hooks/useReactions', () => ({
  useToggleReaction: () => ({ mutate: mockMutate }),
}));

describe('ReactionButton', () => {
  beforeEach(() => {
    mockMutate.mockReset();
  });

  it('optimistically increments the count and updates the accessibility label on celebrate', () => {
    render(
      <ReactionButton logId="log-1" initialCount={2} initialHasReacted={false} />,
    );

    fireEvent.press(screen.getByRole('button'));

    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByLabelText('Remove celebration. 3 celebrations')).toBeTruthy();
    expect(mockMutate).toHaveBeenCalledWith(
      { logId: 'log-1', hasReacted: false },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it('rolls the optimistic state back when the mutation errors', async () => {
    mockMutate.mockImplementation((_vars, options) => options.onError());

    render(
      <ReactionButton logId="log-1" initialCount={1} initialHasReacted={true} />,
    );

    fireEvent.press(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('1')).toBeTruthy();
      expect(screen.getByLabelText('Remove celebration. 1 celebrations')).toBeTruthy();
    });
  });
});
