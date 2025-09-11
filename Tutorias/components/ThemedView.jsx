// ThemedView: View with background color adapting to theme.
import { View } from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';

export function ThemedView({ style, lightColor, darkColor, ...otherProps }) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');
  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
