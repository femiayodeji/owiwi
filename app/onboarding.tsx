// First run: pick keywords, set times, add a provider, allow notifications.
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeywordEditor } from '../src/components/KeywordEditor';
import { Owiwi } from '../src/components/Owiwi';
import { ProgressBar } from '../src/components/ProgressBar';
import { ProviderForm } from '../src/components/ProviderForm';
import { Button, Section, TimeStepper, ui } from '../src/components/ui';
import { getDb } from '../src/db/client';
import { getActiveProvider } from '../src/db/queries';
import { saveSettings } from '../src/db/settings';
import { haptic } from '../src/lib/haptics';
import { colors, space } from '../src/lib/theme';
import { requestPermission, syncReminders } from '../src/notifications';
import { useFeed } from '../src/store/feed';

type Step = 'welcome' | 'keywords' | 'times' | 'provider' | 'notifications';
const ORDER: Step[] = ['welcome', 'keywords', 'times', 'provider', 'notifications'];

export default function Onboarding() {
  const [step, setStep] = useState<Step>('welcome');
  // 1 = forward (slide in from the right), -1 = back.
  const [dir, setDir] = useState<1 | -1>(1);
  const [enabledKeywords, setEnabledKeywords] = useState(0);
  const [morning, setMorning] = useState(useFeed.getState().settings.morning_time);
  const [evening, setEvening] = useState(useFeed.getState().settings.evening_time);
  const [hasProvider, setHasProvider] = useState(false);
  const refresh = useFeed((s) => s.refresh);

  const next = () => {
    setDir(1);
    setStep(ORDER[Math.min(ORDER.indexOf(step) + 1, ORDER.length - 1)]);
  };
  const back = () => {
    setDir(-1);
    setStep(ORDER[Math.max(ORDER.indexOf(step) - 1, 0)]);
  };

  const finish = async (askNotifications: boolean) => {
    if (askNotifications) await requestPermission();
    await saveSettings(await getDb(), { onboarded: '1' });
    await refresh();
    haptic.success();
    void syncReminders();
    router.replace('/');
  };

  return (
    <SafeAreaView style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <View style={styles.progress}>
          <ProgressBar progress={(ORDER.indexOf(step) + 1) / ORDER.length} complete={false} />
        </View>

        {step === 'welcome' ? (
          <StepView key="welcome" dir={dir}>
            <View style={styles.center}>
              <Owiwi emotion="happy" size={200} />
              <Text style={[ui.h1, styles.title]}>Owiwi</Text>
              <Text style={[ui.body, styles.centerText]}>Real news. Better days.</Text>
              <Text style={[ui.muted, styles.centerText, { marginTop: space.md }]}>
                A morning and an evening digest of the stories you care about, summarized by your own AI provider. Everything stays on this
                phone.
              </Text>
              <View style={styles.actions}>
                <Button title="Let's start" onPress={next} />
              </View>
            </View>
          </StepView>
        ) : null}

        {step === 'keywords' ? (
          <StepView key="keywords" dir={dir}>
            <View>
              <Text style={ui.h1}>What do you follow?</Text>
              <Text style={[ui.muted, styles.lead]}>Pick a few topics. Broad ("sports") or narrow ("LLM") both work.</Text>
              <KeywordEditor onChange={(list) => setEnabledKeywords(list.filter((k) => k.enabled).length)} />
              <Nav onBack={back} onNext={next} nextDisabled={enabledKeywords === 0} />
            </View>
          </StepView>
        ) : null}

        {step === 'times' ? (
          <StepView key="times" dir={dir}>
            <View>
              <Text style={ui.h1}>When do you read?</Text>
              <Text style={[ui.muted, styles.lead]}>Owiwi prepares a digest for each slot. You can change this any time.</Text>
              <Section>
                <TimeStepper label="Morning" value={morning} onChange={setMorning} />
                <TimeStepper label="Evening" value={evening} onChange={setEvening} />
              </Section>
              <Nav
                onBack={back}
                onNext={async () => {
                  await saveSettings(await getDb(), { morning_time: morning, evening_time: evening });
                  setHasProvider((await getActiveProvider(await getDb())) != null);
                  next();
                }}
              />
            </View>
          </StepView>
        ) : null}

        {step === 'provider' ? (
          <StepView key="provider" dir={dir}>
            <View>
              <Text style={ui.h1}>Connect your AI</Text>
              <Text style={[ui.muted, styles.lead]}>
                Owiwi uses your own provider and API key to write the summaries. The key is stored only in this phone's secure keystore.
              </Text>
              {hasProvider ? (
                <Text style={[ui.body, { color: colors.success, marginBottom: space.md }]}>Provider saved.</Text>
              ) : (
                <ProviderForm onSaved={() => setHasProvider(true)} />
              )}
              <Nav onBack={back} onNext={next} nextDisabled={!hasProvider} />
            </View>
          </StepView>
        ) : null}

        {step === 'notifications' ? (
          <StepView key="notifications" dir={dir}>
            <View style={styles.center}>
              <Owiwi emotion="idle" size={180} />
              <Text style={[ui.h1, styles.title]}>A gentle nudge?</Text>
              <Text style={[ui.muted, styles.centerText]}>
                Owiwi can remind you at {morning} and {evening} when your digest is ready to read, plus one evening nudge if your streak is
                at risk. Reminders are scheduled on this phone. Nothing is sent to a server.
              </Text>
              <View style={styles.actions}>
                <Button title="Allow reminders" onPress={() => void finish(true)} />
                <Button title="Not now" variant="ghost" onPress={() => void finish(false)} />
              </View>
            </View>
          </StepView>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StepView({ dir, children }: { dir: 1 | -1; children: ReactNode }) {
  return (
    <Animated.View
      entering={(dir > 0 ? SlideInRight : SlideInLeft).springify().damping(20).stiffness(160)}
      exiting={(dir > 0 ? SlideOutLeft : SlideOutRight).duration(220)}
    >
      {children}
    </Animated.View>
  );
}

function Nav({ onBack, onNext, nextDisabled }: { onBack: () => void; onNext: () => void; nextDisabled?: boolean }) {
  return (
    <View style={[styles.actions, { flexDirection: 'row' }]}>
      <View style={{ flex: 1 }}>
        <Button title="Back" variant="secondary" onPress={onBack} />
      </View>
      <View style={{ flex: 1 }}>
        <Button title="Next" onPress={onNext} disabled={nextDisabled} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { marginBottom: space.lg, marginTop: space.sm },
  center: { alignItems: 'center', paddingTop: space.lg },
  title: { marginTop: space.lg, textAlign: 'center' },
  centerText: { textAlign: 'center', marginTop: space.sm },
  lead: { marginTop: space.sm, marginBottom: space.lg },
  actions: { marginTop: space.xl, gap: space.sm, alignSelf: 'stretch' },
});
