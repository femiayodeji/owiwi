import fs from 'node:fs';
import path from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const OWIWI_INDIGO = '#5B5BD6';

// Android renders the small notification icon as a mask, so it must be a
// white-on-transparent silhouette of the Owiwi head (96x96). It hasn't been
// delivered yet; until it exists we omit it (Android falls back to the app icon
// mask, which shows as a solid shape).
const NOTIFICATION_ICON = './assets/owiwi/notification-icon.png';
const hasNotificationIcon = fs.existsSync(path.join(__dirname, NOTIFICATION_ICON));

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Owiwi',
  slug: 'owiwi',
  scheme: 'owiwi',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'app.owiwi',
  },
  android: {
    package: 'app.owiwi',
    adaptiveIcon: {
      backgroundColor: '#1E2342',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-secure-store',
    'expo-web-browser',
    [
      'expo-notifications',
      {
        color: OWIWI_INDIGO,
        ...(hasNotificationIcon ? { icon: NOTIFICATION_ICON } : {}),
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
  },
});
