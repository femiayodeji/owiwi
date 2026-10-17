import type { ImageSourcePropType } from 'react-native';

export type OwiwiEmotion = 'idle' | 'happy' | 'thinking' | 'celebrate' | 'sad' | 'sleepy';

/** Brand copy paired with each state (from the brand sheet). */
export const OWIWI_COPY: Record<OwiwiEmotion, string> = {
  idle: 'Ready for your next read.',
  happy: "Good morning! Let's catch up.",
  thinking: 'Gathering and summarizing your top stories...',
  celebrate: 'You did it! Streak +1',
  sad: 'No worries. Tomorrow is a new day.',
  sleepy: 'Rest well. More news tomorrow.',
};

/**
 * State artwork from the brand design. MISSING: the designer has not delivered
 * the individual transparent PNGs yet (only docs/design/owiwi-brand-sheet).
 * When they land in assets/owiwi/ (with @2x/@3x), register them here, e.g.
 *   idle: require('../../assets/owiwi/idle.png'),
 * Until then <Owiwi /> renders a clearly marked placeholder.
 */
export const OWIWI_ART: Partial<Record<OwiwiEmotion, ImageSourcePropType>> = {};
