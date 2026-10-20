import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getDb } from '../db/client';
import { isDayCompleted } from '../db/queries';
import { loadSettings } from '../db/settings';
import { coalesce, withTimeout } from '../lib/async';
import { localDate } from '../lib/dates';
import { pickCopy, type ReminderKind } from './copy';
import { isTopUpDue, planReminders, REMINDER_PREFIX, reminderId } from './plan';

// Android channel sound is fixed when the channel is created, so a sound change
// needs a new channel id. 'reminders' was the silent-default v1 channel.
export const CHANNEL_ID = 'owiwi_reminders';
const LEGACY_CHANNEL_IDS = ['reminders'];
/** Bundled via the expo-notifications plugin `sounds` option (app.config.ts). */
export const NOTIFICATION_SOUND = 'owiwi_chime.wav';
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
        sound: NOTIFICATION_SOUND,
      });
      for (const id of LEGACY_CHANNEL_IDS) await Notifications.deleteNotificationChannelAsync(id);
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
      content: { title: r.title, body: r.body, sound: NOTIFICATION_SOUND, data: { url: '/' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.fireAt, channelId: CHANNEL_ID },
    });
  }
}

// A stuck native call must not hold the sync lock forever.
const SYNC_TIMEOUT_MS = 20000;
let lastSync: { at: number; date: string } | null = null;

const runSync = coalesce(async () => {
  try {
    await withTimeout(doSync(), SYNC_TIMEOUT_MS, 'reminder sync');
    const now = new Date();
    lastSync = { at: now.getTime(), date: localDate(now) };
  } catch (e) {
    warn('sync', e);
  }
});

/**
 * Cancel and reschedule the next days of reminders. Overlapping calls share one
 * run (plus one trailing rerun if something changed mid-sync). Never throws.
 * Use after settings changes.
 */
export function syncReminders(): Promise<void> {
  return runSync();
}

let topUp: Promise<void> | null = null;

/**
 * Foreground top-up: like syncReminders(), but skipped if a sync already ran
 * recently today. AppState flips to 'active' after every permission dialog and
 * in-app browser visit, and each sync is dozens of native calls.
 */
export function topUpReminders(): Promise<void> {
  // Boot and the first AppState 'active' both ask: join, don't queue a rerun.
  if (topUp) return topUp;
  if (!isTopUpDue(lastSync, new Date())) return Promise.resolve();
  topUp = runSync().finally(() => {
    topUp = null;
  });
  return topUp;
}

/** Call when the user completes the day so the streak-saver nudge doesn't fire. */
export async function cancelTodayNudge(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(reminderId('nudge', localDate()));
  } catch (e) {
    warn('cancel nudge', e);
  }
}

/**
 * Fires one reminder a few seconds from now, using the real copy and channel,
 * so the icon and text can be checked on a device. Not part of the schedule.
 */
export async function sendTestNotification(kind: ReminderKind = 'morning', delaySeconds = 3): Promise<boolean> {
  if (!(await requestPermission())) return false;
  const { title, body } = pickCopy(kind, localDate());
  await Notifications.scheduleNotificationAsync({
    identifier: `test.${Date.now()}`,
    content: { title, body, sound: NOTIFICATION_SOUND, data: { url: '/' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySeconds, channelId: CHANNEL_ID },
  });
  return true;
}
