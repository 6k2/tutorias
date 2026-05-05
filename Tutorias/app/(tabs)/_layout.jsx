// Tab layout: controls the bottom tabs and guards access with cute alerts xd
import { Tabs } from 'expo-router';
import React from 'react';
import { useTopAlert } from '../../components/TopAlert';
import CustomTabBar from '../../components/CustomTabBar';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { useSession } from '../../contexts/AuthContext';

export default function TabLayout() {
  // We show a custom bottom bar and block tabs that need login
  const topAlert = useTopAlert();
  const session = useSession();

  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarShowLabel: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="person.circle" color={color} />
          ),
          listeners: {
            tabPress: (e) => {
              if (!session.isAuthenticated) {
                e.preventDefault();
                topAlert.show(
                  'Inicia sesión para abrir tu perfil',
                  'info'
                );
              }
            },
          },
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="house.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="chats"
        options={{
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={26}
              name="bubble.left.and.bubble.right.fill"
              color={color}
            />
          ),
          listeners: {
            tabPress: (e) => {
              if (!session.isAuthenticated) {
                e.preventDefault();
                topAlert.show(
                  'Inicia sesión para usar los chats',
                  'info'
                );
              }
            },
          },
        }}
      />
    </Tabs>
  );
}

