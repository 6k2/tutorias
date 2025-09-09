import React, { createContext, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TopAlertContext = createContext(null);

export function TopAlertProvider({ children }) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info'); // 'info' | 'success' | 'error'
  const timer = useRef(null);

  const show = (msg, t = 'info', durationMs = 2200) => {
    setMessage(msg);
    setType(t);
    if (timer.current) clearTimeout(timer.current);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      Animated.timing(translateY, { toValue: 0, duration: 180, easing: Easing.out(Easing.ease), useNativeDriver: false }),
    ]).start();
    timer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 220, easing: Easing.in(Easing.ease), useNativeDriver: false }),
        Animated.timing(translateY, { toValue: -20, duration: 220, easing: Easing.in(Easing.ease), useNativeDriver: false }),
      ]).start();
    }, durationMs);
  };

  const value = useMemo(() => ({ show }), []);

  const bg = type === 'success' ? '#34D399' : type === 'error' ? '#f87171' : '#FF8E53';
  const color = type === 'success' ? '#0b3b2f' : type === 'error' ? '#5a0b0b' : '#1B1E36';

  return (
    <TopAlertContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        <Animated.View
          style={[
            styles.container,
            { top: (insets?.top ?? 0) + 8, opacity, transform: [{ translateY }] },
          ]}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          <View style={[styles.banner, { backgroundColor: bg }]}> 
            <Text style={[styles.text, { color }]}>{message}</Text>
          </View>
        </Animated.View>
        {children}
      </View>
    </TopAlertContext.Provider>
  );
}

export function useTopAlert() {
  const ctx = useContext(TopAlertContext);
  if (!ctx) throw new Error('useTopAlert must be used within TopAlertProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    pointerEvents: 'none',
  },
  banner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 6px 12px rgba(0,0,0,0.2)' }
      : { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 }),
  },
  text: { fontWeight: '800' },
});
