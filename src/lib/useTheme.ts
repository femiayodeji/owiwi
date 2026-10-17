import { StyleSheet, useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { useFeed } from '../store/feed';
import { resolveTheme, type Theme } from './theme';

/** The active theme: the user's theme_mode setting, with 'system' following the OS. */
export function useTheme(): Theme {
  const mode = useFeed((s) => s.settings.theme_mode);
  const scheme = useColorScheme();
  return resolveTheme(mode, scheme === 'dark' ? 'dark' : 'light');
}

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

/**
 * Themed StyleSheet hook factory. Styles are created once per theme and cached.
 *   const useStyles = makeStyles((t) => ({ box: { backgroundColor: t.colors.surface } }));
 *   const styles = useStyles();
 */
export function makeStyles<T extends NamedStyles>(factory: (theme: Theme) => T): () => Readonly<T> {
  const cache = new Map<string, Readonly<T>>();
  return function useStyles(): Readonly<T> {
    const theme = useTheme();
    let styles = cache.get(theme.name);
    if (!styles) {
      styles = StyleSheet.create(factory(theme));
      cache.set(theme.name, styles);
    }
    return styles;
  };
}
