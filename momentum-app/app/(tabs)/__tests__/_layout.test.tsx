import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: 0 }),
}));

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));

jest.mock('@/components/log/LogSheet', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockLogSheet() {
    return React.createElement(Text, null, 'Mock Log Sheet');
  };
});

jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');

  const Tabs = ({ children }: { children: React.ReactNode }) =>
    React.createElement(View, null, children);

  Tabs.Screen = () => null;

  return { Tabs };
});

import TabLayout from '../_layout';

describe('TabLayout', () => {
  it('opens the log sheet when the add button is pressed', () => {
    render(<TabLayout />);

    fireEvent.press(screen.getByLabelText('Create session'));

    expect(screen.getByText('Mock Log Sheet')).toBeTruthy();
  });
});
