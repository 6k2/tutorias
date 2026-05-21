/**
 * Theme helper: gives you the right color for light/dark mode, xd
 * Learn more: https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '../constants/Colors';
import { useColorScheme } from './useColorScheme';
import { useThemeOverride } from './useThemeOverride';

export function useThemeColor(props, colorName) {
<<<<<<< HEAD
  const override = useThemeOverride();
  const colorScheme = useColorScheme();
  const theme = override ?? colorScheme ?? 'light';
=======
  const theme = useColorScheme() ?? 'light';
>>>>>>> parent of 68c1754 (Add web UI screens and tab layout)
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
