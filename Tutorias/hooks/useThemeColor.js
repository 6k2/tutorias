/**
 * Theme helper: gives you the right color for light/dark mode, xd
 * Learn more: https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '../constants/Colors';
import { useColorScheme } from './useColorScheme';

export function useThemeColor(props, colorName) {
<<<<<<< Updated upstream
  const theme = useColorScheme() ?? 'light';
=======
  const override = useThemeOverride();
  const colorScheme = useColorScheme();
  const theme = override ?? colorScheme ?? 'light';
>>>>>>> Stashed changes
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
