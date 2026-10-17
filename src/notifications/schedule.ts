import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getDb } from '../db/client';
import { isDayCompleted } from '../db/queries';
import { loadSettings } from '../db/settings';
import { localDate } from '../lib/dates';
import { planReminders, REMINDER_PREFIX, reminderId } from './plan';

export const CHANNEL_ID = 'reminders';
const OWIWI_INDIGO = '#5B5BD6';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

function warn(what: string, e: unknown): void {
  // Short message only: never log request bodies or settings.
  const msg = e instanceof Error ? e.message : 'unknown error';
  console.warn(`[notifications] ${what} failed: ${msg}`);
}

let configured = false;

export async function configureNotifications(): Promise<void> {
  if (!configured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    configured = true;
  }
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Daily reminders',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: OWIWI_INDIGO,
      });
    } catch (e) {
      warn('channel setup', e);
    }
  }
}

function toState(p: Notifications.NotificationPermissionsStatus): PermissionState {
  if (p.granted) return 'granted';
  const ios = p.ios?.status;
  if (ios === Notifications.IosAuthorizationStatus.PROVISIONAL || ios === Notifications.IosAuthorizationStatus.EPHEMERAL) {
    return 'granted';
  }
  return p.status === 'undetermined' ? 'undetermined' : 'denied';
}

export async function getPermissionStatus(): Promise<PermissionState> {
  try {
    return toState(await Notifications.getPermissionsAsync());
  } catch (e) {
    warn('permission check', e);
    return 'undetermined';
  }
}

/** Asks for permission. On Android 13+ the channel must exist before the prompt shows. */
export async function requestPermission(): Promise<boolean> {
  try {
    await configureNotifications();
    const current = await Notifications.getPermissionsAsync();
    if (toState(current) === 'granted') return true;
    if (!current.canAskAgain) return false;
    const res = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return toState(res) === 'granted';
  } catch (e) {
    warn('permission request', e);
    return false;
  }
}

async function cancelOwiwiReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((r) => r.identifier.startsWith(REMINDER_PREFIX))
      .map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier)),
  );
}

async function doSync(): Promise<void> {
  if ((await getPermissionStatus()) !== 'granted') return;
  const db = await getDb();
  const settings = await loadSettings(db);
  const now = new Date();
  const doneToday = await isDayCompleted(db, localDate(now));
  const plan = planReminders({ now, settings, doneToday });

  await cancelOwiwiReminders();
  for (const r of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: { url: '/' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.fireAt, channelId: CHANNEL_ID },
    });
  }
}

let inFlight: Promise<void> | null = null;
let rerun = false;

/** Top-up: cancel and reschedule the next days of reminders. Safe to call often; never throws. */
export function syncReminders(): Promise<void> {
  if (inFlight) {
    // A change arrived mid-sync: run once more after the current pass.
    rerun = true;
    return inFlight;
  }
  inFlight = (async () => {
    try {
      do {
        rerun = false;
        await doSync();
      } while (rerun);
    } catch (e) {
      warn('sync', e);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Call when the user completes the day so the streak-saver nudge doesn't fire. */
export async function cancelTodayNudge(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(reminderId('nudge', localDate()));
  } catch (e) {
    warn('cancel nudge', e);
  }
}
