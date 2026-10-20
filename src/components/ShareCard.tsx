// Share-as-image: renders a story as a 4:5 card in the current theme, off screen,
// and captures it to a PNG. <ShareCardHost /> is mounted once in app/_layout.tsx;
// call renderShareImage() from anywhere.
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Image, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { create } from 'zustand';
import type { BookmarkSource } from '../lib/bookmarks';
import { relativeTime } from '../lib/dates';
import { shareTitleSize } from '../lib/share';
import { radius, space } from '../lib/theme';
import { makeStyles } from '../lib/useTheme';

const HEAD = require('../../assets/owiwi/notification-head.png');

// Laid out at 360x450 dp, saved at 1080x1350 px (a crisp 4:5 for chats and feeds).
const CARD_W = 360;
const CARD_H = 450;
const OUT_W = 1080;
const OUT_H = 1350;
const TIMEOUT_MS = 4000;

interface Job {
  id: number;
  story: BookmarkSource;
  resolve: (uri: string) => void;
  reject: (e: Error) => void;
}

const useShareCard = create<{ job: Job | null }>(() => ({ job: null }));
let nextId = 1;

/** Renders the story card off screen and resolves with a temporary PNG file URI. */
export function renderShareImage(story: BookmarkSource): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const done = () => {
      clearTimeout(timer);
      if (useShareCard.getState().job?.id === id) useShareCard.setState({ job: null });
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error('Share image timed out'));
    }, TIMEOUT_MS);
    useShareCard.setState({
      job: {
        id,
        story,
        resolve: (uri) => {
          done();
          resolve(uri);
        },
        reject: (e) => {
          done();
          reject(e);
        },
      },
    });
  });
}

export function ShareCardHost() {
  const job = useShareCard((s) => s.job);
  return job ? <ShareCardCapture key={job.id} job={job} /> : null;
}

function ShareCardCapture({ job }: { job: Job }) {
  const styles = useStyles();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [laidOut, setLaidOut] = useState(false);
  const [headReady, setHeadReady] = useState(false);
  const { story } = job;
  const meta = [story.source, relativeTime(story.publishedAt)].filter(Boolean).join(' · ');
  const titleSize = shareTitleSize(story.title);

  // Capture once the card is laid out and the owl head has loaded (or failed to).
  useEffect(() => {
    if (!laidOut || !headReady) return;
    const frame = requestAnimationFrame(() => {
      if (!ref.current) return;
      captureRef(ref.current, { format: 'png', result: 'tmpfile', width: OUT_W, height: OUT_H })
        .then(job.resolve)
        .catch((e: unknown) => job.reject(e instanceof Error ? e : new Error(String(e))));
    });
    return () => cancelAnimationFrame(frame);
  }, [laidOut, headReady, job]);

  return (
    // Far off screen: rendered for capture only, never seen.
    <View pointerEvents="none" style={styles.offscreen} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View ref={ref} collapsable={false} style={styles.canvas} onLayout={() => setLaidOut(true)}>
        <View style={styles.card}>
          {story.topic ? (
            <View style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                {story.topic}
              </Text>
            </View>
          ) : null}
          {/* RSS/LLM text is untrusted: plain Text only. */}
          <Text style={[styles.title, { fontSize: titleSize, lineHeight: Math.round(titleSize * 1.22) }]} numberOfLines={4}>
            {story.title}
          </Text>
          <Text style={styles.summary} numberOfLines={7}>
            {story.summary}
          </Text>
          <View style={styles.spacer} />
          <View style={styles.footer}>
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
            <View style={styles.brand}>
              <Image source={HEAD} style={styles.head} onLoadEnd={() => setHeadReady(true)} />
              <Text style={styles.via}>via Owiwi</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => {
  const font = t.type.readingFont ? { fontFamily: t.type.readingFont } : {};
  const scale = t.type.readingScale;
  return {
    offscreen: { position: 'absolute', left: -10000, top: 0 },
    canvas: { width: CARD_W, height: CARD_H, backgroundColor: t.colors.bg, padding: space.md },
    card: {
      flex: 1,
      backgroundColor: t.colors.surface,
      borderRadius: radius.lg,
      padding: space.lg,
      borderWidth: 2,
      borderColor: t.colors.border,
      borderBottomWidth: 5,
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
    chipText: { color: t.colors.chipText, fontWeight: '700', fontSize: 11 },
    title: { ...font, fontWeight: '800', color: t.colors.navy },
    summary: {
      ...font,
      fontSize: 14 * scale,
      lineHeight: Math.round(21 * scale * t.type.readingLeading),
      color: t.colors.text,
      marginTop: space.sm,
    },
    spacer: { flex: 1 },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
      paddingTop: space.sm,
    },
    meta: { flex: 1, color: t.colors.textMuted, fontSize: 11 },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    head: { width: 22, height: 22 },
    via: { color: t.colors.indigo, fontWeight: '800', fontSize: 12 },
  } as const;
});
