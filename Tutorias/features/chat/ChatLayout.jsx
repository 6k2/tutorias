import React from 'react';
import { View, StyleSheet, useWindowDimensions, Pressable, Text } from 'react-native';
import { useThemeColor } from '../../hooks/useThemeColor';

export function ChatLayout({ sidebar, thread, isThreadOpen, onBack, offline = false }) {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;

  const background = useThemeColor({}, 'background');
  const divider = useThemeColor({}, 'icon');
  const text = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');
  const offlineBg = useThemeColor({}, 'background');

  const OfflineBanner = () =>
    offline ? (
      <View
        style={[styles.offlineBanner, { borderColor: `${divider}40`, backgroundColor: `${offlineBg}ee` }]}
      >
        <Text style={[styles.offlineIcon, { color: tint }]}>[x]</Text>
        <Text style={[styles.offlineText, { color: text }]}>Sin conexion</Text>
      </View>
    ) : null;

  if (isSmallScreen) {
    return (
      <View style={[styles.container, { backgroundColor: background }]}>
        <OfflineBanner />
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
      <OfflineBanner />
      <View style={styles.desktopRow}>
        <View style={[styles.sidebarWrapper, { borderRightColor: `${divider}40` }]}>{sidebar}</View>
        <View style={styles.threadWrapper}>{thread}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  desktopRow: {
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
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 12,
  },
  offlineIcon: {
    fontWeight: '700',
  },
  offlineText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
