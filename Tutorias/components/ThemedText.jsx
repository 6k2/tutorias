<<<<<<< Updated upstream:Tutorias/components/ThemedText.tsx
import { StyleSheet, Text, type TextProps } from 'react-native';
=======
// A text component that adapts to theme and exposes a few styles, xd
import { StyleSheet, Text } from 'react-native';
>>>>>>> Stashed changes:Tutorias/components/ThemedText.jsx

import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
<<<<<<< Updated upstream:Tutorias/components/ThemedText.tsx
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
=======
}) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text'); // auto color ftw
>>>>>>> Stashed changes:Tutorias/components/ThemedText.jsx

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: '#0a7ea4',
  },
});
