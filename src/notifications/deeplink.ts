import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

/** Routes notification taps to the feed. The feed picks the active slot itself. */
export function useNotificationDeepLink(): void {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return;
    const { identifier, content } = response.notification.request;
    if (handled.current === identifier) return;
    handled.current = identifier;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    if (typeof content.data?.url !== 'string') return;
    router.replace('/');
  }, [response]);
}
