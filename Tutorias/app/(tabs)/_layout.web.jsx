import { Tabs } from 'expo-router';
import React from 'react';

export default function WebTabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="chats" />
    </Tabs>
  );
}
