
// Custom bottom tab bar with a cute elevated center bubble for Home, xd

import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';

export default function CustomTabBar({ state, descriptors, navigation }) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          const icon = options.tabBarIcon
            ? options.tabBarIcon({ color: isFocused ? '#ffffff' : '#8C8FA5', focused: isFocused, size: 26 })
            : <IconSymbol size={26} color={isFocused ? '#ffffff' : '#8C8FA5'} name={'house.fill'} />;

          // Central elevated bubble for the middle tab (Home)
          const isCenter = route.name === 'index';
          return (
            <TouchableOpacity key={route.key} onPress={onPress} style={styles.item} accessibilityRole="button">
              <View style={[
                styles.iconWrap,
                isFocused && !isCenter && styles.iconFocused,
                isCenter && (isFocused ? styles.centerFocused : styles.centerIdle),
              ]}>
                {icon}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  pill: {
    height: 68,
    borderRadius: 22,
    backgroundColor: '#1F223D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
  },
  item: { flex: 1, alignItems: 'center' },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  iconFocused: {
    backgroundColor: '#FF8E53',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 16px rgba(255,142,83,0.35)' }
      : { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 }),
  },
  centerIdle: { marginTop: -8 },
  centerFocused: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF8E53',
    marginTop: -20,
    borderWidth: 4,
    borderColor: '#1F223D',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 10px 18px rgba(255,142,83,0.45)' }
      : { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 }),
  },
});

