import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, Text, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from './ui/tokens';

const labels = { index: 'Inicio', profile: 'Perfil', chats: 'Chats' };
const icons = { index: 'dashboard', profile: 'person', chats: 'forum' };

export default function CustomTabBar({ state, descriptors, navigation }) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;
  return (
    <View style={isDesktop ? styles.sidebar : styles.bottomBar}>
      {isDesktop && <View style={styles.brandBlock}><View style={styles.logo}><Text style={styles.logoText}>T</Text></View><Text style={styles.brand}>Tutorias</Text><Text style={styles.caption}>Learning OS</Text></View>}
      <View style={styles.navList}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <TouchableOpacity key={route.key} onPress={onPress} style={[isDesktop ? styles.sideItem : styles.item, isFocused && styles.activeItem]} accessibilityRole="button">
              {options.tabBarIcon ? options.tabBarIcon({ color: isFocused ? '#fff' : tokens.color.muted }) : <MaterialIcons name={icons[route.name] || 'circle'} size={22} color={isFocused ? '#fff' : tokens.color.muted} />}
              {isDesktop && <Text style={[styles.sideLabel, isFocused && styles.activeLabel]}>{labels[route.name] || route.name}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const webShadow = Platform.OS === 'web' ? { boxShadow: '0 20px 50px rgba(15,23,42,.10)' } : {};
const styles = StyleSheet.create({
  sidebar: { position: 'fixed', left: 18, top: 18, bottom: 18, width: 236, borderRadius: 28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: tokens.color.line, padding: 18, zIndex: 50, ...webShadow },
  brandBlock: { marginBottom: 22, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: tokens.color.line }, logo: { width: 46, height: 46, borderRadius: 16, backgroundColor: tokens.color.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, logoText: { color: '#fff', fontWeight: '900', fontSize: 22 }, brand: { color: tokens.color.ink, fontSize: 20, fontWeight: '900' }, caption: { color: tokens.color.muted, fontWeight: '700', marginTop: 2 }, navList: { gap: 8 },
  sideItem: { minHeight: 48, borderRadius: 16, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }, sideLabel: { color: tokens.color.muted, fontWeight: '900' }, activeItem: { backgroundColor: tokens.color.brand }, activeLabel: { color: '#fff' },
  bottomBar: { position: 'absolute', left: 18, right: 18, bottom: 18, height: 66, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: tokens.color.line, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', zIndex: 50, ...webShadow }, item: { height: 46, width: 74, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
