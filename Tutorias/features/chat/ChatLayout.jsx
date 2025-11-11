import React from 'react';
import { View, StyleSheet, useWindowDimensions, Pressable, Text } from 'react-native';
import { useThemeColor } from '../../hooks/useThemeColor';

export function ChatLayout({ sidebar, thread, isThreadOpen, onBack }) {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;

  const background = useThemeColor({}, 'background');
  const divider = useThemeColor({}, 'icon');
  const text = useThemeColor({}, 'text');

  if (isSmallScreen) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}> 
        {isThreadOpen ? (
          <View style={styles.threadWrapper}>
            <Pressable
              style={[styles.backRow, { borderBottomColor: `${divider}40` }]}
              onPress={onBack}
            >
              <Text style={[styles.backText, { color: text }]}>Volver</Text>
            </Pressable>
            {thread}
          </View>
        ) : (
          <View style={[styles.sidebarWrapper, styles.sidebarMobile]}>{sidebar}</View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: background }]}> 
      <View
        style={[styles.sidebarWrapper, { borderRightColor: `${divider}40` }]}
      >
        {sidebar}
      </View>
      <View style={styles.threadWrapper}>{thread}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarWrapper: {
    width: 320,
    maxWidth: 360,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  sidebarMobile: {
    width: '100%',
  },
  threadWrapper: {
    flex: 1,
  },
  backRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
