/**
 * Theme helper: gives you the right color for light/dark mode, xd
 * Learn more: https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '../constants/Colors';
import { useColorScheme } from './useColorScheme';
import { useThemeOverride } from './useThemeOverride';

export function useThemeColor(props, colorName) {
  const override = useThemeOverride();
  const theme = override ?? useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
