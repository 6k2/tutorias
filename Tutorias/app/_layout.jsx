// App root layout: sets up safe area + global top alert + routes, xd
import { Stack } from 'expo-router';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TopAlertProvider } from '../components/TopAlert';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TopAlertProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </TopAlertProvider>
    </SafeAreaProvider>
  );
}
