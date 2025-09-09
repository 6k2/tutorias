import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarActiveTintColor: '#FF8E53',
        tabBarInactiveTintColor: '#8C8FA5',
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            marginHorizontal: 12,
            marginBottom: 12,
            borderRadius: 20,
            height: 64,
            backgroundColor: 'rgba(28,31,54,0.85)',
            borderTopWidth: 0,
          },
          default: {
            marginHorizontal: 12,
            marginBottom: 12,
            borderRadius: 20,
            height: 64,
            backgroundColor: '#1F223D',
            borderTopWidth: 0,
          },
        }),
      }}>
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.circle" color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bubble.left.and.bubble.right.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}

