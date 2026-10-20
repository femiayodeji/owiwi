// Saved stories, newest first. Bookmarks are copies, so they outlive the daily wipe.
import { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import { Owiwi } from '../src/components/Owiwi';
import { ACTION_ROW_BLEED, ActionLink, ReadMoreAction, ShareAction } from '../src/components/StoryActions';
import { showToast } from '../src/components/Toast';
import { Button, useUi } from '../src/components/ui';
import { getDb } from '../src/db/client';
import { listBookmarks, type Bookmark } from '../src/db/queries';
import { sortBookmarks } from '../src/lib/bookmarks';
import { relativeTime } from '../src/lib/dates';
import { haptic } from '../src/lib/haptics';
import { radius, space } from '../src/lib/theme';
import { makeStyles } from '../src/lib/useTheme';
import { useBookmarks } from '../src/store/bookmarks';

export default function Bookmarks() {
  const ui = useUi();
  const styles = useStyles();
  const [items, setItems] = useState<Bookmark[] | null>(null);
  const remove = useBookmarks((s) => s.remove);
  const restore = useBookmarks((s) => s.restore);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        const list = await listBookmarks(await getDb());
        if (live) setItems(list);
      })().catch(() => {
        if (live) setItems([]);
      });
      return () => {
        live = false;
      };
    }, []),
  );

  const onRemove = (b: Bookmark) => {
    haptic.select();
    setItems((cur) => (cur ? cur.filter((x) => x.url !== b.url) : cur));
    remove(b.url)
      .then(() =>
        showToast('Removed', 'info', {
          label: 'Undo',
          onPress: () => {
            void restore(b)
              .then(() => setItems((cur) => sortBookmarks([...(cur ?? []).filter((x) => x.url !== b.url), b])))
              .catch(() => showToast("Couldn't restore that bookmark.", 'warning'));
          },
        }),
      )
      .catch(() => {
        setItems((cur) => sortBookmarks([...(cur ?? []).filter((x) => x.url !== b.url), b]));
        showToast("Couldn't remove that bookmark. Try again.", 'warning');
      });
  };

  if (items === null) return <View style={ui.screen} />;

  if (items.length === 0) {
    return (
      <View style={[ui.screen, styles.empty]}>
        <Animated.View entering={FadeInDown.springify().damping(16)} style={styles.emptyInner}>
          <Owiwi emotion="idle" showCopy />
          <Text style={[ui.h2, styles.center, { marginTop: space.lg }]}>No bookmarks yet</Text>
          <Text style={[ui.muted, styles.center]}>
            Tap ☆ Save on any story in your digest to keep it here. Saved stories stay after the daily clean-up.
          </Text>
          <View style={styles.emptyAction}>
            <Button title="Back to my digest" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <FlatList
      style={ui.screen}
      contentContainerStyle={ui.content}
      data={items}
      keyExtractor={(b) => b.url}
      ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
      ListHeaderComponent={
        <Text style={[ui.muted, styles.header]}>
          {items.length === 1 ? '1 saved story' : `${items.length} saved stories`}
        </Text>
      }
      renderItem={({ item, index }) => <BookmarkItem bookmark={item} index={index} onRemove={() => onRemove(item)} />}
    />
  );
}

function BookmarkItem({ bookmark: b, index, onRemove }: { bookmark: Bookmark; index: number; onRemove: () => void }) {
  const styles = useStyles();
  const meta = [b.source, relativeTime(b.publishedAt)].filter(Boolean).join(' · ');
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 6) * 60)
        .springify()
        .damping(16)}
      exiting={FadeOut.duration(160)}
      layout={LinearTransition.springify().damping(18)}
      style={styles.card}
    >
      {b.topic ? (
        <View style={styles.chip}>
          <Text style={styles.chipText} numberOfLines={1}>
            {b.topic}
          </Text>
        </View>
      ) : null}
      {/* Saved RSS/LLM text is still untrusted: plain Text only. */}
      <Text style={styles.title}>{b.title}</Text>
      <Text style={styles.summary}>{b.summary}</Text>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      <View style={styles.actions}>
        <ActionLink label="Remove" glyph="★" highlight accessibilityLabel={`Remove bookmark: ${b.title}`} onPress={onRemove} />
        <ShareAction story={b} />
        <View style={{ flex: 1 }} />
        <ReadMoreAction url={b.url} title={b.title} />
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => {
  const font = t.type.readingFont ? { fontFamily: t.type.readingFont } : {};
  const scale = t.type.readingScale;
  return {
    empty: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
    emptyInner: { alignItems: 'center', alignSelf: 'stretch' },
    emptyAction: { marginTop: space.lg, alignSelf: 'stretch' },
    center: { textAlign: 'center', marginTop: space.sm },
    header: { marginBottom: space.md, marginLeft: 4 },
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: radius.lg,
      padding: space.md + 4,
      borderWidth: 2,
      borderColor: t.colors.border,
      borderBottomWidth: 4,
      borderBottomColor: t.colors.borderStrong,
    },
    chip: {
      alignSelf: 'flex-start',
      backgroundColor: t.colors.chipBg,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
      marginBottom: space.sm,
      maxWidth: '100%',
    },
    chipText: { color: t.colors.chipText, fontWeight: '700', fontSize: 12 },
    title: { ...font, fontSize: 19 * scale, lineHeight: Math.round(25 * scale), fontWeight: '800', color: t.colors.navy },
    summary: {
      ...font,
      fontSize: 15 * scale,
      lineHeight: Math.round(22 * scale * t.type.readingLeading),
      color: t.colors.text,
      marginTop: space.sm,
    },
    meta: { color: t.colors.textMuted, fontSize: 13, marginTop: space.sm },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      marginTop: space.md + ACTION_ROW_BLEED,
      marginBottom: ACTION_ROW_BLEED,
    },
  } as const;
});
