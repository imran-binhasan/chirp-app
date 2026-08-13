import { useColorScheme } from 'react-native';

const lightColors = {
  background: '#faf9f8',
  surface: '#ffffff',
  text: '#1a1c1c',
  textSecondary: '#57423a',
  primary: '#1a1c1c',
  primaryText: '#ffffff',
  border: '#e3e2e1',
  inputBackground: '#f4f3f2',
  /** Likes read as a like in every theme — never the monochrome primary. */
  like: '#e0245e',
  danger: '#c4314b',
  unreadHighlight: '#eef4f8',
};

const darkColors: typeof lightColors = {
  background: '#121212',
  surface: '#1e1e1e',
  text: '#ffffff',
  textSecondary: '#a0a0a0',
  primary: '#ffffff',
  primaryText: '#000000',
  border: '#333333',
  inputBackground: '#2a2a2a',
  like: '#f91880',
  danger: '#f2647a',
  unreadHighlight: '#1a232b',
};

export type ThemeColors = typeof lightColors;

export const useThemeColors = (): ThemeColors =>
  useColorScheme() === 'dark' ? darkColors : lightColors;
