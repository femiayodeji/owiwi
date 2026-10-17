// Colors sampled by eye from docs/design/owiwi-brand-sheet.png.png.
export const colors = {
  indigo: '#5B5BD6', // Owiwi body, primary accent
  indigoDark: '#3F3FB0',
  navy: '#1E2342', // wordmark, primary text
  text: '#1E2342',
  textMuted: '#6B6F86',
  textFaint: '#9A9DB0',
  bg: '#F7F5F0',
  surface: '#FFFFFF',
  border: '#E6E3DC',
  danger: '#D6455B',
  success: '#2E9E5B',
  beak: '#F5A524',
} as const;

/** Pastel panel behind each owl state, as on the brand sheet. */
export const emotionBg = {
  idle: '#E8F1FE',
  happy: '#FEF6DC',
  thinking: '#EEEAFD',
  celebrate: '#E6F7E9',
  sad: '#FDEBE4',
  sleepy: '#DCE3FB',
} as const;

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
