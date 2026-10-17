// Owiwi themes. Brand colors sampled by eye from docs/design/owiwi-brand-sheet.png.png.
// Components read the active theme with useTheme() / makeStyles() (src/lib/useTheme.ts);
// never hard-code colors in components.

export type ThemeMode = 'system' | 'light' | 'dark' | 'reading';
export type ThemeName = 'light' | 'dark' | 'reading';

export interface Palette {
  indigo: string; // primary accent, Owiwi body
  indigoDark: string; // pressed/lip shade of the primary
  navy: string; // headings
  text: string; // body text
  textMuted: string;
  textFaint: string;
  bg: string; // screen background
  surface: string; // cards, sheets, inputs
  surfaceAlt: string; // subtle fills: stepper buttons, tracks, pressed rows
  border: string;
  borderStrong: string; // 3D lips on secondary buttons and cards
  onPrimary: string; // text/icons on indigo
  chipBg: string; // topic chip
  chipText: string;
  danger: string;
  success: string;
  warning: string;
  beak: string;
  overlay: string; // modal backdrop
  shadow: string;
}

export interface Typography {
  /** Font family for long-form reading text (card title/summary). undefined = system font. */
  readingFont: string | undefined;
  /** Multiplier for card title/summary sizes. */
  readingScale: number;
  /** Extra line-height multiplier for summaries. */
  readingLeading: number;
}

export interface Theme {
  name: ThemeName;
  dark: boolean; // drives StatusBar style and keyboard appearance
  colors: Palette;
  /** Pastel panel behind each owl state (brand sheet), adjusted per theme. */
  emotionBg: Record<'idle' | 'happy' | 'thinking' | 'celebrate' | 'sad' | 'sleepy', string>;
  type: Typography;
}

const light: Theme = {
  name: 'light',
  dark: false,
  colors: {
    indigo: '#5B5BD6',
    indigoDark: '#3F3FB0',
    navy: '#1E2342',
    text: '#1E2342',
    textMuted: '#6B6F86',
    textFaint: '#9A9DB0',
    bg: '#F7F5F0',
    surface: '#FFFFFF',
    surfaceAlt: '#F0EEE8',
    border: '#E6E3DC',
    borderStrong: '#D9D5CC',
    onPrimary: '#FFFFFF',
    chipBg: '#EEEAFD',
    chipText: '#3F3FB0',
    danger: '#D6455B',
    success: '#2E9E5B',
    warning: '#E08A00',
    beak: '#F5A524',
    overlay: 'rgba(20, 22, 40, 0.45)',
    shadow: '#1E2342',
  },
  emotionBg: {
    idle: '#E8F1FE',
    happy: '#FEF6DC',
    thinking: '#EEEAFD',
    celebrate: '#E6F7E9',
    sad: '#FDEBE4',
    sleepy: '#DCE3FB',
  },
  type: { readingFont: undefined, readingScale: 1, readingLeading: 1 },
};

const dark: Theme = {
  name: 'dark',
  dark: true,
  colors: {
    indigo: '#7B7BEA',
    indigoDark: '#4E4EC0',
    navy: '#ECEDF7',
    text: '#E3E4F0',
    textMuted: '#A3A6BF',
    textFaint: '#6F7290',
    bg: '#12142A',
    surface: '#1C1F3A',
    surfaceAlt: '#262A4A',
    border: '#2E3254',
    borderStrong: '#0B0D1E',
    onPrimary: '#FFFFFF',
    chipBg: '#2D2B5E',
    chipText: '#C9C6FF',
    danger: '#F0687C',
    success: '#4CC27E',
    warning: '#F2A93B',
    beak: '#F5A524',
    overlay: 'rgba(0, 0, 0, 0.6)',
    shadow: '#000000',
  },
  emotionBg: {
    idle: '#1E2A44',
    happy: '#3A3320',
    thinking: '#2A2752',
    celebrate: '#1E3A2A',
    sad: '#3E2A28',
    sleepy: '#232C52',
  },
  type: { readingFont: undefined, readingScale: 1, readingLeading: 1 },
};

// Warm paper tones, serif text and roomier type for long reading sessions.
const reading: Theme = {
  name: 'reading',
  dark: false,
  colors: {
    indigo: '#5A55B8',
    indigoDark: '#403C93',
    navy: '#2F2620',
    text: '#3B2F27',
    textMuted: '#7A6A5C',
    textFaint: '#A8998A',
    bg: '#F4ECD8',
    surface: '#FBF6E9',
    surfaceAlt: '#EDE3CB',
    border: '#E2D6BB',
    borderStrong: '#D3C5A6',
    onPrimary: '#FFFDF7',
    chipBg: '#E9E1F2',
    chipText: '#403C93',
    danger: '#B8434F',
    success: '#3E8A55',
    warning: '#B97300',
    beak: '#E89B1F',
    overlay: 'rgba(47, 38, 32, 0.45)',
    shadow: '#5A4632',
  },
  emotionBg: {
    idle: '#EDE6D6',
    happy: '#F6ECCB',
    thinking: '#EAE2EC',
    celebrate: '#E3EDD6',
    sad: '#F3E1D3',
    sleepy: '#E2E2E3',
  },
  type: { readingFont: 'serif', readingScale: 1.08, readingLeading: 1.12 },
};

export const THEMES: Record<ThemeName, Theme> = { light, dark, reading };

export const THEME_MODE_OPTIONS: readonly { value: ThemeMode; label: string; description: string }[] = [
  { value: 'system', label: 'System', description: "Follows your phone's light or dark setting" },
  { value: 'light', label: 'Light', description: 'Bright and clean' },
  { value: 'dark', label: 'Dark', description: 'Easy on the eyes at night' },
  { value: 'reading', label: 'Reading', description: 'Warm paper tones and a serif font for longer reads' },
];

export function resolveTheme(mode: ThemeMode, systemScheme: 'light' | 'dark' | null | undefined): Theme {
  if (mode === 'system') return systemScheme === 'dark' ? dark : light;
  return THEMES[mode];
}

/** @deprecated Static light palette; use useTheme() so dark/reading modes apply. */
export const colors = light.colors;
/** @deprecated Use useTheme().emotionBg. */
export const emotionBg = light.emotionBg;

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
