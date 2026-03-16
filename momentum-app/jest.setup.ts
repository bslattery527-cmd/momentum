import '@testing-library/jest-native/extend-expect';

jest.mock('react-native/src/private/animated/NativeAnimatedHelper');
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    Ionicons: ({ name, ...props }: { name: string }) => React.createElement(Text, props, name),
  };
});

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View, ScrollView } = require('react-native');

  return {
    __esModule: true,
    default: React.forwardRef(({ children }: { children: React.ReactNode }, _ref: unknown) => (
      React.createElement(View, null, children)
    )),
    BottomSheetScrollView: ScrollView,
  };
});

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

Object.defineProperty(global, '__DEV__', {
  value: true,
  configurable: true,
});

if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = jest.fn() as any;
}

const originalConsoleError = console.error;

jest.spyOn(console, 'error').mockImplementation((message?: unknown, ...args: unknown[]) => {
  if (
    typeof message === 'string' &&
    message.includes('not wrapped in act')
  ) {
    return;
  }

  originalConsoleError(message as any, ...args);
});
