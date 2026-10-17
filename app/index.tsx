// The feed: today's digest for the viewed slot as a full-screen vertical pager.
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Owiwi, type OwiwiEmotion } from '../src/components/Owiwi';
import { Pager } from '../src/components/Pager';
import { Button, ui } from '../src/components/ui';
import { STEP_LABEL, type GenerationStep } from '../src/digest/generate';
import { isLateNight, SLOT_LABEL } from '../src/digest/slot';
import { colors, radius, space } from '../src/lib/theme';
import type { Slot } from '../src/llm/types';
import { useFeed, type SlotState } from '../src/store/feed';

const STEPS: GenerationStep[] = ['fetching', 'writing', 'saving'];

export default function Feed() {
  const { settings, activeSlot, viewSlot, slots, streak, setViewSlot, generate, completeDay } = useFeed();
  const [index, setIndex] = useState(0);

  if (settings.onboarded !== '1') return <Redirect href="/onboarding" />;

  const state = slots[viewSlot];
  const total = state.cards.length;

  const confirmRegenerate = () =>
    Alert.alert('Regenerate this digest?', `Owiwi will fetch fresh headlines and rewrite your ${viewSlot} digest. This uses your API tokens.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Regenerate', onPress: () => void generate(viewSlot, true) },
    ]);

  const openMenu = () =>
    Alert.alert('Owiwi', undefined, [
      ...(state.status === 'ready' ? [{ text: 'Regenerate digest', onPress: confirmRegenerate }] : []),
      { text: 'Settings', onPress: () => router.push('/settings') },
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  return (
    <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <View style={styles.streak} accessibilityLabel={`${streak.current} day streak`}>
          <Text style={styles.streakText}>🔥 {streak.current}</Text>
        </View>
        <View style={styles.slots}>
          {(['morning', 'evening'] as Slot[]).map((slot) => (
            <SlotTab
              key={slot}
              slot={slot}
              selected={slot === viewSlot}
              isActive={slot === activeSlot}
              onPress={() => {
                setIndex(0);
                setViewSlot(slot);
              }}
            />
          ))}
        </View>
        <Pressable onPress={openMenu} hitSlop={12} accessibilityLabel="Menu" style={styles.menu}>
          <Text style={styles.menuText}>⋯</Text>
        </Pressable>
      </View>

      {state.status === 'ready' && total > 0 ? (
        <Text style={styles.progress}>{index < total ? `${index + 1} / ${total}` : 'Done'}</Text>
      ) : null}
      {state.status === 'ready' && state.error ? <Text style={[ui.error, styles.banner]}>{state.error}</Text> : null}
      {state.status === 'ready' && state.failedKeywords.length > 0 ? (
        <Text style={[ui.muted, styles.banner]}>Couldn't reach news for: {state.failedKeywords.join(', ')}</Text>
      ) : null}

      <View style={{ flex: 1 }}>
        <SlotBody
          slot={viewSlot}
          isActive={viewSlot === activeSlot}
          state={state}
          streakLost={streak.lost}
          streakCurrent={streak.current}
          onGenerate={() => void generate(viewSlot)}
          onRegenerate={confirmRegenerate}
          onIndex={setIndex}
          onReachedEnd={() => void completeDay(viewSlot)}
        />
      </View>
    </SafeAreaView>
  );
}

function SlotTab({ slot, selected, isActive, onPress }: { slot: Slot; selected: boolean; isActive: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={[styles.tab, selected && styles.tabOn, !isActive && !selected && styles.tabMuted]}
    >
      <Text style={[styles.tabText, selected && styles.tabTextOn]}>{SLOT_LABEL[slot]}</Text>
    </Pressable>
  );
}

function SlotBody(props: {
  slot: Slot;
  isActive: boolean;
  state: SlotState;
  streakLost: boolean;
  streakCurrent: number;
  onGenerate: () => void;
  onRegenerate: () => void;
  onIndex: (i: number) => void;
  onReachedEnd: () => void;
}) {
  const { slot, isActive, state } = props;

  if (state.status === 'loading' || state.status === 'generating') {
    const current = state.step ? STEPS.indexOf(state.step) : -1;
    return (
      <Centered>
        <Owiwi emotion="thinking" showCopy />
        <View style={styles.steps}>
          {STEPS.map((step, i) => (
            <Text key={step} style={[styles.step, i < current && styles.stepDone, i === current && styles.stepNow]}>
              {i < current ? '✓ ' : i === current ? '• ' : '  '}
              {STEP_LABEL[step]}
            </Text>
          ))}
        </View>
      </Centered>
    );
  }

  if (state.status === 'ready' && state.cards.length > 0) {
    return (
      <Pager
        key={state.cards[0].id}
        cards={state.cards}
        slot={slot}
        streak={props.streakCurrent}
        onIndexChange={props.onIndex}
        onReachedEnd={props.onReachedEnd}
        onPullToRegenerate={props.onRegenerate}
      />
    );
  }

  if (state.status === 'empty') {
    return (
      <Centered>
        <Owiwi emotion="sad" />
        <Text style={[ui.h2, styles.center]}>No fresh headlines</Text>
        <Text style={[ui.muted, styles.center]}>
          Nothing new came back for your keywords in the last day. Try broader keywords, or check again later.
        </Text>
        <View style={styles.actions}>
          <Button title="Try again" onPress={props.onGenerate} />
          <Button title="Edit keywords" variant="secondary" onPress={() => router.push('/settings/keywords')} />
        </View>
      </Centered>
    );
  }

  if (state.status === 'failed') {
    return (
      <Centered>
        <Owiwi emotion="sad" />
        <Text style={[ui.h2, styles.center]}>Your digest didn't come together</Text>
        <Text style={[ui.muted, styles.center]}>{state.error ?? 'Something went wrong. Try again.'}</Text>
        <View style={styles.actions}>
          <Button title="Try again" onPress={props.onGenerate} />
          <Button title="Open settings" variant="secondary" onPress={() => router.push('/settings')} />
        </View>
      </Centered>
    );
  }

  // No digest yet. Only the active slot auto-generates; the other one waits for a tap.
  const now = new Date();
  const emotion: OwiwiEmotion = isLateNight(now) ? 'sleepy' : props.streakLost ? 'sad' : slot === 'morning' ? 'happy' : 'idle';
  return (
    <Centered>
      <Owiwi emotion={emotion} showCopy />
      <Text style={[ui.muted, styles.center, { marginTop: space.lg }]}>
        {isActive ? 'Your digest is ready to build.' : `No ${slot} digest today. Make one if you like.`}
      </Text>
      <View style={styles.actions}>
        <Button title={`Generate ${slot} digest`} onPress={props.onGenerate} variant={isActive ? 'primary' : 'secondary'} />
      </View>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.sm, gap: space.sm },
  streak: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
  streakText: { fontWeight: '800', color: colors.navy, fontSize: 15 },
  slots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill },
  tabOn: { backgroundColor: colors.indigo },
  tabMuted: { opacity: 0.45 },
  tabText: { fontWeight: '700', color: colors.navy },
  tabTextOn: { color: '#fff' },
  menu: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  menuText: { fontSize: 24, color: colors.navy, fontWeight: '700' },
  progress: { textAlign: 'center', color: colors.textMuted, marginTop: space.sm, fontVariant: ['tabular-nums'] },
  banner: { textAlign: 'center', marginHorizontal: space.md, marginTop: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  center: { textAlign: 'center', marginTop: space.md },
  actions: { marginTop: space.lg, gap: space.sm, alignSelf: 'stretch' },
  steps: { marginTop: space.lg, gap: 6 },
  step: { color: colors.textFaint, fontSize: 15 },
  stepNow: { color: colors.navy, fontWeight: '700' },
  stepDone: { color: colors.success },
});
