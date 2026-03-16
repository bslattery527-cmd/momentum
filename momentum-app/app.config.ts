import type { ExpoConfig } from 'expo/config';
import os from 'node:os';

type MomentumExpoConfig = ExpoConfig & { newArchEnabled?: boolean };
type ExpoPluginEntry = NonNullable<ExpoConfig['plugins']>[number];

function getLocalNetworkHosts(): string[] {
  const hosts = new Set(['localhost', '127.0.0.1']);
  const explicitHost = process.env.EXPO_PUBLIC_LOCAL_API_HOST;

  if (explicitHost) {
    hosts.add(explicitHost);
    return Array.from(hosts);
  }

  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        hosts.add(entry.address);
      }
    }
  }

  return Array.from(hosts);
}

const localNetworkHosts = getLocalNetworkHosts();

const localNetworkExceptions = Object.fromEntries(
  localNetworkHosts.map((host) => [
    host,
    {
      NSExceptionAllowsInsecureHTTPLoads: true,
      NSIncludesSubdomains: true,
    },
  ])
);

const imagePickerPlugin: ExpoPluginEntry = [
  'expo-image-picker',
  {
    photosPermission: 'Momentum needs access to your photos to attach images to your work logs.',
    cameraPermission: 'Momentum needs camera access to take photos for your work logs.',
  },
];

const notificationsPlugin: ExpoPluginEntry = [
  'expo-notifications',
  {
    icon: './assets/notification-icon.png',
    color: '#6C63FF',
  },
];

const config: MomentumExpoConfig = {
  name: 'Momentum',
  slug: 'momentum',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'momentum',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#1A1A2E',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.momentum.app',
    usesAppleSignIn: true,
    infoPlist: {
      NSPhotoLibraryUsageDescription:
        'Momentum needs access to your photos to attach images to your work logs.',
      NSCameraUsageDescription:
        'Momentum needs camera access to take photos for your work logs.',
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
        NSExceptionDomains: localNetworkExceptions,
      },
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1A1A2E',
    },
    package: 'com.momentum.app',
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    'expo-apple-authentication',
    imagePickerPlugin,
    notificationsPlugin,
  ],
  extra: {
    eas: {
      projectId: 'your-project-id',
    },
    router: {
      origin: false,
    },
  },
};

export default config;
