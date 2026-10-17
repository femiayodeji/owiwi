import fs from 'node:fs';
import path from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const OWIWI_INDIGO = '#5B5BD6';
const OWIWI_NAVY = '#222B4D'; // app icon background, sampled from the brand sheet
const OWIWI_CREAM = '#F7F5F0';

// Android renders the small notification icon as a mask, so it must be a
// white-on-transparent silhouette of the Owiwi head (96x96). Omitted if missing.
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
  userInterfaceStyle: 'automatic', // themes: System follows the OS (needs expo-system-ui)
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'app.owiwi',
  },
  android: {
    package: 'app.owiwi',
    adaptiveIcon: {
      backgroundColor: OWIWI_NAVY,
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
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 200, backgroundColor: OWIWI_CREAM }],
    [
      'expo-notifications',
      {
        color: OWIWI_INDIGO,
        sounds: ['./assets/sounds/owiwi_chime.wav'],
        ...(hasNotificationIcon ? { icon: NOTIFICATION_ICON } : {}),
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
  },
});
