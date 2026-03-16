import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import DurationPicker from '../DurationPicker';

describe('DurationPicker', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform });
  });

  it('renders native stepper controls and updates the total duration', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    const onChange = jest.fn();

    render(<DurationPicker label="Duration" value={3600} onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('Duration hours up'));
    expect(onChange).toHaveBeenCalledWith(7200);

    fireEvent.press(screen.getByLabelText('Duration minutes up'));
    expect(onChange).toHaveBeenCalledWith(3900);
  });
});
