import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';
import type { Card } from '../db/queries';
import { relativeTime } from '../lib/dates';
import { colors, radius, space } from '../lib/theme';

interface Props {
  card: Card;
  height: number;
  index: number;
  total: number;
}

export function StoryCard({ card, height, index, total }: Props) {
  const when = relativeTime(card.publishedAt);
  const meta = [card.source, when].filter(Boolean).join(' · ');

  return (
    <View style={[styles.page, { height }]}>
      <Animated.View entering={FadeInDown.duration(380)} style={styles.card}>
        {card.topic ? (
          <View style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>
              {card.topic}
            </Text>
          </View>
        ) : null}
        {/* RSS/LLM text is untrusted: rendered strictly as plain Text. */}
        <Text style={styles.title} accessibilityRole="header">
          {card.title}
        </Text>
        <Text style={styles.summary}>{card.summary}</Text>
        <View style={styles.footer}>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Read more: ${card.title}`}
            hitSlop={10}
            onPress={() => void WebBrowser.openBrowserAsync(card.url)}
          >
            <Text style={styles.readMore}>Read more ↗</Text>
          </Pressable>
        </View>
      </Animated.View>
      <Text style={styles.position}>
        {index + 1} / {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.md, paddingVertical: space.md, justifyContent: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.navy,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEEAFD',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: space.md,
    maxWidth: '100%',
  },
  chipText: { color: colors.indigoDark, fontWeight: '700', fontSize: 13 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: colors.navy },
  summary: { fontSize: 17, lineHeight: 26, color: colors.text, marginTop: space.md },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg, gap: space.md },
  meta: { flex: 1, color: colors.textMuted, fontSize: 13 },
  readMore: { color: colors.indigo, fontSize: 14, fontWeight: '600' },
  position: { textAlign: 'center', color: colors.textFaint, marginTop: space.md, fontSize: 13 },
});
