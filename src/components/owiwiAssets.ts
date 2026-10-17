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
 * State artwork, cut from docs/design/owiwi-brand-sheet.png.png by
 * scripts/extract-brand-art.py (the sheet is the only source so far; replace
 * with the designer's originals when delivered, same file names).
 */
export const OWIWI_ART: Partial<Record<OwiwiEmotion, ImageSourcePropType>> = {
  idle: require('../../assets/owiwi/idle.png'),
  happy: require('../../assets/owiwi/happy.png'),
  thinking: require('../../assets/owiwi/thinking.png'),
  celebrate: require('../../assets/owiwi/celebrate.png'),
  sad: require('../../assets/owiwi/sad.png'),
  sleepy: require('../../assets/owiwi/sleepy.png'),
};
