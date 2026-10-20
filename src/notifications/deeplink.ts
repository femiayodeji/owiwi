import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

// Module scope, not a ref: the native module keeps returning the last response
// for the life of the process, and a remounted root layout must not replay it.
const handled = new Set<string>();

/**
 * Routes notification taps to the feed. The feed picks the active slot itself.
 *
 * `navReady` must be true only once the root Stack is mounted. Navigating
 * earlier makes expo-router REPLACE the root layout route itself, which
 * remounts the layout, which replays the same response: an endless remount
 * loop behind the splash screen.
 */
export function useNotificationDeepLink(navReady: boolean): void {
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!navReady || !response) return;
    const { identifier, content } = response.notification.request;
    if (handled.has(identifier)) return;
    handled.add(identifier);
    try {
      Notifications.clearLastNotificationResponse();
    } catch {
      // Older native module: the module-level `handled` set still prevents replays.
    }
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    if (typeof content.data?.url !== 'string') return;
    router.replace('/');
  }, [navReady, response]);
}
