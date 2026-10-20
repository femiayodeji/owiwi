// Secondary text actions shared by story cards and the Bookmarks screen:
// Save (bookmark toggle), Share and Read more. Deliberately quiet; the story is the focus.
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { haptic } from '../lib/haptics';
import { shareStory } from '../lib/shareStory';
import { space } from '../lib/theme';
import { makeStyles } from '../lib/useTheme';
import { useBookmarks } from '../store/bookmarks';
import type { BookmarkSource } from '../lib/bookmarks';
import { PressScale } from './PressScale';
import { showToast } from './Toast';

export function ActionLink({
  label,
  glyph,
  onPress,
  accessibilityLabel,
  selected,
  role = 'button',
}: {
  label: string;
  glyph?: string;
  onPress: () => void;
  accessibilityLabel: string;
  selected?: boolean;
  role?: 'button' | 'link';
}) {
  const styles = useStyles();
  return (
    <PressScale
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={role === 'button' && selected !== undefined ? { selected } : undefined}
      hitSlop={10}
      scaleTo={0.9}
      dimTo={0.7}
      onPress={onPress}
      style={styles.link}
    >
      {glyph ? <Text style={[styles.glyph, selected && styles.glyphOn]}>{glyph}</Text> : null}
      <Text style={styles.label}>{label}</Text>
    </PressScale>
  );
}

/** Bookmark toggle: outlined star when not saved, filled when saved. */
export function SaveAction({ story }: { story: BookmarkSource }) {
  const saved = useBookmarks((s) => s.urls.has(story.url));
  const toggle = useBookmarks((s) => s.toggle);
  return (
    <ActionLink
      label={saved ? 'Saved' : 'Save'}
      glyph={saved ? '★' : '☆'}
      selected={saved}
      accessibilityLabel={saved ? `Remove bookmark: ${story.title}` : `Bookmark: ${story.title}`}
      onPress={() => {
        haptic.select();
        toggle(story)
          .then((now) => {
            if (now) {
              haptic.success();
              showToast('Saved to Bookmarks.', 'info', { label: 'View', onPress: () => router.push('/bookmarks') });
            } else {
              showToast('Removed from Bookmarks.');
            }
          })
          .catch(() => showToast("Couldn't update your bookmarks. Try again.", 'warning'));
      }}
    />
  );
}

export function ShareAction({ story }: { story: BookmarkSource }) {
  return (
    <ActionLink
      label="Share"
      glyph="⇪"
      accessibilityLabel={`Share: ${story.title}`}
      onPress={() => {
        haptic.tap();
        void shareStory(story);
      }}
    />
  );
}

export function ReadMoreAction({ url, title }: { url: string; title: string }) {
  const styles = useStyles();
  return (
    <PressScale
      accessibilityRole="link"
      accessibilityLabel={`Read more: ${title}`}
      hitSlop={10}
      scaleTo={0.9}
      dimTo={0.7}
      onPress={() => {
        haptic.tap();
        void WebBrowser.openBrowserAsync(url);
      }}
    >
      <Text style={styles.readMore}>Read more ↗</Text>
    </PressScale>
  );
}

/** Save · Share on the left, Read more on the right. */
export function StoryActionBar({ story }: { story: BookmarkSource }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <SaveAction story={story} />
      <ShareAction story={story} />
      <View style={styles.spacer} />
      <ReadMoreAction url={story.url} title={story.title} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  spacer: { flex: 1 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  glyph: { color: t.colors.textMuted, fontSize: 15, fontWeight: '700' },
  glyphOn: { color: t.colors.indigo },
  label: { color: t.colors.textMuted, fontSize: 14, fontWeight: '600' },
  readMore: { color: t.colors.indigo, fontSize: 14, fontWeight: '600' },
}));
