// Fallback for using MaterialIcons on Android and web. iOS uses SF Symbols.
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

// Map SF Symbol-like names to Material Icons
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'person.circle': 'account-circle',
  'bubble.left.and.bubble.right.fill': 'forum',
};

export function IconSymbol({ name, size = 24, color, style, weight }) {
  const materialName = MAPPING[name] || 'help-outline';
  return <MaterialIcons color={color} size={size} name={materialName} style={style} />;
}
