<<<<<<< Updated upstream:Tutorias/components/ThemedView.tsx
import { View, type ViewProps } from 'react-native';
=======
// A view that auto-picks background color based on theme (light/dark), xd
import { View } from 'react-native';
>>>>>>> Stashed changes:Tutorias/components/ThemedView.jsx

import { useThemeColor } from '@/hooks/useThemeColor';

<<<<<<< Updated upstream:Tutorias/components/ThemedView.tsx
export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
=======
export function ThemedView({ style, lightColor, darkColor, ...otherProps }) {
  // Fancy name, simple idea: grab a color and apply it
>>>>>>> Stashed changes:Tutorias/components/ThemedView.jsx
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
