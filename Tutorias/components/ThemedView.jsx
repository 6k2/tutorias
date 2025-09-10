import { View } from 'react-native';

import { View, type ViewProps } from 'react-native';

// A view that auto-picks background color based on theme (light/dark), xd
import { View } from 'react-native';
 :Tutorias/components/ThemedView.tsx

import { useThemeColor } from '../hooks/useThemeColor';

export function ThemedView({ style, lightColor, darkColor, ...otherProps }) {

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {

export function ThemedView({ style, lightColor, darkColor, ...otherProps }) {
  // Fancy name, simple idea: grab a color and apply it
 :Tutorias/components/ThemedView.tsx
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
