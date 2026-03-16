import React from 'react';
import { Alert, Platform } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockMutateAsync = jest.fn();
const mockStartStopwatch = jest.fn();

jest.mock('@/hooks/useLog', () => ({
  useCreateLog: () => ({ mutateAsync: mockMutateAsync }),
}));

jest.mock('@/lib/stopwatch', () => ({
  startStopwatch: () => mockStartStopwatch(),
}));

jest.mock('../TaskInput', () => {
  const React = require('react');
  const { Pressable, Text, TextInput, View } = require('react-native');

  return function MockTaskInput({ task, onChange, index }: any) {
    return (
      React.createElement(View, null,
        React.createElement(TextInput, {
          accessibilityLabel: `Task name ${index + 1}`,
          value: task.task_name,
          onChangeText: (text: string) => onChange(index, { ...task, task_name: text }),
        }),
        React.createElement(Pressable, {
          accessibilityLabel: `Choose Coding ${index + 1}`,
          onPress: () => onChange(index, {
            ...task,
            category_id: 'cat-02-code-0000-000000000002',
          }),
        }, React.createElement(Text, null, 'Coding')),
        React.createElement(Pressable, {
          accessibilityLabel: `Set duration ${index + 1}`,
          onPress: () => onChange(index, { ...task, duration: 600 }),
        }, React.createElement(Text, null, '10m')),
      )
    );
  };
});

jest.mock('../ImagePicker', () => () => null);
jest.mock('@/components/common/UserSearchModal', () => () => null);

import LogSheet from '../LogSheet';

describe('LogSheet', () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockStartStopwatch.mockReset();
    alertSpy.mockClear();
    Object.defineProperty(Platform, 'OS', { value: 'web' });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform });
  });

  it('shows a validation alert when required fields are missing', async () => {
    render(<LogSheet onClose={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Log session'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Missing info', 'Please enter a title for your session.');
    });
  });

  it('submits the normalized payload, closes, and resets on success', async () => {
    const onClose = jest.fn();
    const onSuccess = jest.fn();
    const bottomSheetRef = { current: { close: jest.fn() } } as any;
    mockMutateAsync.mockResolvedValue({ id: 'log-1' });

    render(
      <LogSheet
        onClose={onClose}
        onSuccess={onSuccess}
        bottomSheetRef={bottomSheetRef}
        prefillDuration={1200}
        prefillStartedAt="2026-03-15T10:00:00.000Z"
        prefillEndedAt="2026-03-15T10:20:00.000Z"
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Session title'), ' Deep Work ');
    fireEvent.press(screen.getByLabelText('Choose Coding 1'));
    fireEvent.changeText(screen.getByLabelText('Task name 1'), ' API refactor ');
    fireEvent.changeText(screen.getByLabelText('Reflection note'), ' Shipped tests ');
    fireEvent.press(screen.getByLabelText('Log session'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        title: 'Deep Work',
        note: 'Shipped tests',
        is_published: false,
        started_at: '2026-03-15T10:00:00.000Z',
        ended_at: '2026-03-15T10:20:00.000Z',
        tasks: [
          {
            task_name: 'API refactor',
            category_id: 'cat-02-code-0000-000000000002',
            duration: 1200,
            sort_order: 0,
          },
        ],
      });
      expect(bottomSheetRef.current.close).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('renders the full form on native platforms', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });

    render(<LogSheet onClose={jest.fn()} />);

    expect(screen.getByText('Tasks')).toBeTruthy();
    expect(screen.getByText('Tag users')).toBeTruthy();
    expect(screen.getByLabelText('Log session')).toBeTruthy();
    expect(screen.queryByText('Use the web version for full form')).toBeNull();
  });
});
