import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { auth, db } from '../../app/config/firebase';

export const webTokens = {
  color: {
    bg: '#F6F8FC',
    surface: '#FFFFFF',
    surfaceAlt: '#EEF3FF',
    ink: '#172033',
    muted: '#667085',
    line: '#D9E2F2',
    brand: '#2563EB',
    brand2: '#06B6D4',
    brand3: '#F97316',
    good: '#059669',
    goodSoft: '#D1FAE5',
    warn: '#D97706',
    warnSoft: '#FEF3C7',
    bad: '#DC2626',
    badSoft: '#FEE2E2',
    dark: '#111827',
  },
  shadow: {
    soft: {
      boxShadow: '0 18px 60px rgba(15, 23, 42, 0.10)',
    },
    lift: {
      boxShadow: '0 24px 80px rgba(37, 99, 235, 0.20)',
    },
  },
};

export const webSubjects = [
  {
    key: 'calculo',
    title: 'Cálculo',
    tag: 'Matemáticas',
    tone: '#2563EB',
    image: 'https://picsum.photos/seed/tutorias-calculo/1400/900',
  },
  {
    key: 'software',
    title: 'Software',
    tag: 'Tecnología',
    tone: '#06B6D4',
    image: 'https://picsum.photos/seed/tutorias-software/1400/900',
  },
  {
    key: 'biologia',
    title: 'Biología',
    tag: 'Ciencias',
    tone: '#059669',
    image: 'https://picsum.photos/seed/tutorias-biologia/1400/900',
  },
  {
    key: 'algebra',
    title: 'Álgebra',
    tag: 'Lógica',
    tone: '#7C3AED',
    image: 'https://picsum.photos/seed/tutorias-algebra/1400/900',
  },
  {
    key: 'ingles',
    title: 'Inglés',
    tag: 'Idiomas',
    tone: '#F97316',
    image: 'https://picsum.photos/seed/tutorias-ingles/1400/900',
  },
];

const navItems = [
  { label: 'Inicio', route: '/', icon: 'dashboard' },
  { label: 'Perfil', route: '/profile', icon: 'person' },
  { label: 'Chats', route: '/chats', icon: 'forum' },
  { label: 'Agenda', route: '/agenda', icon: 'calendar-month' },
  { label: 'Explorar', route: '/explore', icon: 'travel-explore' },
];

export function useWebSession() {
  const [state, setState] = useState({
    ready: false,
    user: auth.currentUser || null,
    profile: null,
    role: '',
  });

  useEffect(() => {
    let alive = true;
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!alive) return;
      if (!firebaseUser) {
        setState({ ready: true, user: null, profile: null, role: '' });
        return;
      }
      let profile = null;
      try {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        profile = snap.data() || null;
      } catch {
        profile = null;
      }
      if (alive) {
        setState({
          ready: true,
          user: firebaseUser,
          profile,
          role: profile?.role || '',
        });
      }
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  return state;
}

export function AnimatedScreen({ children, delay = 0, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 520,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(y, {
        toValue: 0,
        delay,
        speed: 14,
        bounciness: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, y]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY: y }] }, style]}>
      {children}
    </Animated.View>
  );
}

export function WebShell({ title, subtitle, active, children, actions, compact = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const session = useWebSession();
  const isNarrow = width < 920;
  const content = (
    <View style={[styles.shellBody, isNarrow && styles.shellBodyNarrow]}>
      <AnimatedScreen style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Tutorías</Text>
          <Text style={styles.pageTitle}>{title}</Text>
          {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.headerActions}>
          {actions}
          {session.ready && session.user ? (
            <Pressable
              style={styles.userChip}
              onPress={() => router.push('/profile')}
              accessibilityRole="button"
            >
              <MaterialIcons name="account-circle" size={20} color={webTokens.color.brand} />
              <Text style={styles.userChipText} numberOfLines={1}>
                {session.profile?.username || session.user.email || 'Cuenta'}
              </Text>
            </Pressable>
          ) : (
            <WebButton label="Entrar" icon="login" onPress={() => router.push('/login')} small />
          )}
        </View>
      </AnimatedScreen>
      {children}
    </View>
  );

  if (compact) {
    return <View style={styles.compactPage}>{children}</View>;
  }

  return (
    <View style={styles.shell}>
      {!isNarrow && (
        <AnimatedScreen style={styles.sidebar}>
          <Pressable style={styles.brand} onPress={() => router.push('/')}>
            <LinearGradient
              colors={[webTokens.color.brand, webTokens.color.brand2]}
              style={styles.brandMark}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.brandMarkText}>T</Text>
            </LinearGradient>
            <View>
              <Text style={styles.brandTitle}>Tutorías</Text>
              <Text style={styles.brandSub}>Clases y reservas</Text>
            </View>
          </Pressable>

          <View style={styles.nav}>
            {navItems.map((item) => {
              const isActive = active === item.route || pathname === item.route;
              return (
                <Pressable
                  key={item.route}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                  onPress={() => router.push(item.route)}
                  accessibilityRole="link"
                >
                  <MaterialIcons
                    name={item.icon}
                    size={20}
                    color={isActive ? '#FFFFFF' : webTokens.color.muted}
                  />
                  <Text style={[styles.navText, isActive && styles.navTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <LinearGradient
            colors={['#E0F2FE', '#FFFFFF']}
            style={styles.sidebarCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.sidebarCardTitle}>Aprende sin fricción</Text>
            <Text style={styles.sidebarCardText}>Encuentra docentes, reserva y conversa desde un solo lugar.</Text>
          </LinearGradient>
        </AnimatedScreen>
      )}
      <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
        {isNarrow && (
          <View style={styles.mobileNav}>
            {navItems.map((item) => (
              <Pressable
                key={item.route}
                style={styles.mobileNavItem}
                onPress={() => router.push(item.route)}
                accessibilityRole="link"
              >
                <MaterialIcons name={item.icon} size={20} color={webTokens.color.brand} />
                <Text style={styles.mobileNavText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {content}
      </ScrollView>
    </View>
  );
}

export function AuthShell({ title, subtitle, children, sideTitle, sideText }) {
  const router = useRouter();
  return (
    <View style={styles.authPage}>
      <AnimatedScreen style={styles.authVisual}>
        <LinearGradient
          colors={[webTokens.color.brand, webTokens.color.brand2, webTokens.color.brand3]}
          style={styles.authGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.orbitOne} />
          <View style={styles.orbitTwo} />
          <Text style={styles.authVisualTitle}>{sideTitle || 'Tutorías'}</Text>
          <Text style={styles.authVisualText}>
            {sideText || 'Reserva clases, publica cupos y mantén tus conversaciones organizadas.'}
          </Text>
          <View style={styles.authStats}>
            <WebStat label="Materias" value="5" />
            <WebStat label="Reserva" value="24/7" />
          </View>
        </LinearGradient>
      </AnimatedScreen>
      <AnimatedScreen delay={120} style={styles.authCard}>
        <Pressable style={styles.authBack} onPress={() => router.back()} accessibilityRole="button">
          <MaterialIcons name="arrow-back" size={18} color={webTokens.color.brand} />
          <Text style={styles.authBackText}>Volver</Text>
        </Pressable>
        <Text style={styles.authTitle}>{title}</Text>
        {subtitle ? <Text style={styles.authSubtitle}>{subtitle}</Text> : null}
        {children}
      </AnimatedScreen>
    </View>
  );
}

export function WebCard({ children, style, animated = true, delay = 0, onPress }) {
  const content = (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ hovered }) => [
        styles.card,
        hovered && onPress && styles.cardHover,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
  if (!animated) return content;
  return <AnimatedScreen delay={delay}>{content}</AnimatedScreen>;
}

export function WebButton({ label, icon, onPress, variant = 'primary', disabled, loading, small, style }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ hovered }) => [
        styles.button,
        styles[`button_${variant}`],
        small && styles.buttonSmall,
        hovered && !disabled && styles.buttonHover,
        disabled && styles.buttonDisabled,
        style,
      ]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : webTokens.color.brand} />
      ) : (
        <>
          {icon ? (
            <MaterialIcons
              name={icon}
              size={small ? 16 : 19}
              color={variant === 'primary' ? '#FFFFFF' : webTokens.color.brand}
            />
          ) : null}
          <Text style={[styles.buttonText, variant !== 'primary' && styles.buttonTextAlt]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function WebInput({ label, error, style, right, ...props }) {
  return (
    <View style={[styles.inputGroup, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrap, error && styles.inputError]}>
        <TextInput
          placeholderTextColor="#98A2B3"
          style={styles.input}
          {...props}
        />
        {right}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function WebBadge({ children, tone = 'blue', icon }) {
  const palette = {
    blue: ['#DBEAFE', '#1D4ED8'],
    green: ['#D1FAE5', '#047857'],
    amber: ['#FEF3C7', '#B45309'],
    red: ['#FEE2E2', '#B91C1C'],
    gray: ['#EEF2F7', '#475467'],
  }[tone] || ['#DBEAFE', '#1D4ED8'];
  return (
    <View style={[styles.badge, { backgroundColor: palette[0] }]}>
      {icon ? <MaterialIcons name={icon} size={15} color={palette[1]} /> : null}
      <Text style={[styles.badgeText, { color: palette[1] }]}>{children}</Text>
    </View>
  );
}

export function WebStat({ label, value, icon, tone = webTokens.color.brand }) {
  return (
    <View style={styles.stat}>
      {icon ? (
        <View style={[styles.statIcon, { backgroundColor: `${tone}18` }]}>
          <MaterialIcons name={icon} size={20} color={tone} />
        </View>
      ) : null}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon = 'inbox', title, text, action }) {
  return (
    <WebCard style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <MaterialIcons name={icon} size={34} color={webTokens.color.brand} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
      {action}
    </WebCard>
  );
}

export function LoadingState({ label = 'Cargando...' }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={webTokens.color.brand} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function SubjectImage({ uri, style }) {
  return <Image source={{ uri }} style={[styles.subjectImage, style]} resizeMode="cover" />;
}

export const decodeParam = (value) => decodeURIComponent(Array.isArray(value) ? value[0] || '' : value || '');

export const formatSlot = (slot) => {
  if (!slot) return 'Horario por definir';
  const label = {
    Mon: 'Lun',
    Tue: 'Mar',
    Wed: 'Mié',
    Thu: 'Jue',
    Fri: 'Vie',
    Sat: 'Sáb',
    Sun: 'Dom',
    Lun: 'Lun',
    Mar: 'Mar',
    Mie: 'Mié',
    Jue: 'Jue',
    Vie: 'Vie',
    Sab: 'Sáb',
    Dom: 'Dom',
  }[slot.day] || slot.day;
  const pad = (value) => String(Number(value || 0)).padStart(2, '0');
  return `${label} · ${pad(slot.hourStart)}:00 - ${pad(slot.hourEnd)}:00`;
};

export const roleIsTeacher = (role) => String(role || '').toLowerCase() === 'teacher';
export const roleIsStudent = (role) => String(role || '').toLowerCase() === 'student';

export async function signOutWeb(router) {
  await signOut(auth);
  router.replace('/');
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    minHeight: '100vh',
    backgroundColor: webTokens.color.bg,
    flexDirection: 'row',
  },
  sidebar: {
    width: 282,
    padding: 22,
    borderRightWidth: 1,
    borderRightColor: webTokens.color.line,
    backgroundColor: '#FFFFFF',
    gap: 24,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  brandTitle: {
    color: webTokens.color.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  brandSub: {
    color: webTokens.color.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  nav: {
    gap: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
  },
  navItemActive: {
    backgroundColor: webTokens.color.brand,
    ...webTokens.shadow.lift,
  },
  navText: {
    color: webTokens.color.muted,
    fontWeight: '800',
  },
  navTextActive: {
    color: '#FFFFFF',
  },
  sidebarCard: {
    marginTop: 'auto',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  sidebarCardTitle: {
    color: webTokens.color.ink,
    fontWeight: '900',
    fontSize: 17,
  },
  sidebarCardText: {
    color: webTokens.color.muted,
    marginTop: 8,
    lineHeight: 20,
  },
  main: {
    flex: 1,
  },
  mainContent: {
    minHeight: '100vh',
  },
  shellBody: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    padding: 28,
    gap: 22,
  },
  shellBodyNarrow: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  kicker: {
    color: webTokens.color.brand,
    textTransform: 'uppercase',
    fontSize: 12,
    fontWeight: '900',
  },
  pageTitle: {
    color: webTokens.color.ink,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '900',
    marginTop: 4,
  },
  pageSubtitle: {
    color: webTokens.color.muted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
    maxWidth: 720,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: webTokens.color.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: 260,
  },
  userChipText: {
    color: webTokens.color.ink,
    fontWeight: '800',
  },
  mobileNav: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: webTokens.color.line,
    overflow: 'scroll',
  },
  mobileNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#EEF4FF',
  },
  mobileNavText: {
    color: webTokens.color.brand,
    fontWeight: '800',
  },
  compactPage: {
    flex: 1,
    minHeight: '100vh',
    backgroundColor: webTokens.color.bg,
  },
  authPage: {
    minHeight: '100vh',
    backgroundColor: webTokens.color.bg,
    flexDirection: 'row',
    padding: 24,
    gap: 24,
  },
  authVisual: {
    flex: 1.1,
    minWidth: 360,
  },
  authGradient: {
    flex: 1,
    minHeight: 620,
    borderRadius: 28,
    padding: 36,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    ...webTokens.shadow.lift,
  },
  orbitOne: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    right: -70,
    top: 70,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  orbitTwo: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    left: 50,
    top: 130,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  authVisualTitle: {
    color: '#FFFFFF',
    fontSize: 52,
    lineHeight: 58,
    fontWeight: '900',
  },
  authVisualText: {
    color: '#EAF2FF',
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 580,
    marginTop: 14,
  },
  authStats: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 24,
  },
  authCard: {
    flex: 0.9,
    maxWidth: 520,
    minWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 34,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: webTokens.color.line,
    ...webTokens.shadow.soft,
  },
  authBack: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  authBackText: {
    color: webTokens.color.brand,
    fontWeight: '800',
  },
  authTitle: {
    color: webTokens.color.ink,
    fontSize: 34,
    fontWeight: '900',
  },
  authSubtitle: {
    color: webTokens.color.muted,
    marginTop: 8,
    lineHeight: 23,
  },
  card: {
    backgroundColor: webTokens.color.surface,
    borderWidth: 1,
    borderColor: webTokens.color.line,
    borderRadius: 18,
    padding: 18,
    ...webTokens.shadow.soft,
  },
  cardHover: {
    transform: [{ translateY: -3 }],
    ...webTokens.shadow.lift,
  },
  button: {
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  buttonSmall: {
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  button_primary: {
    backgroundColor: webTokens.color.brand,
    borderColor: webTokens.color.brand,
  },
  button_secondary: {
    backgroundColor: '#FFFFFF',
    borderColor: webTokens.color.line,
  },
  button_ghost: {
    backgroundColor: '#EEF4FF',
    borderColor: '#D8E7FF',
  },
  button_danger: {
    backgroundColor: webTokens.color.badSoft,
    borderColor: '#FECACA',
  },
  buttonHover: {
    opacity: 0.92,
    transform: [{ translateY: -1 }],
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  buttonTextAlt: {
    color: webTokens.color.brand,
  },
  inputGroup: {
    gap: 7,
    marginTop: 14,
  },
  label: {
    color: webTokens.color.ink,
    fontWeight: '800',
  },
  inputWrap: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: webTokens.color.line,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  inputError: {
    borderColor: webTokens.color.bad,
  },
  input: {
    flex: 1,
    color: webTokens.color.ink,
    paddingHorizontal: 14,
    paddingVertical: 13,
    outlineStyle: 'none',
  },
  errorText: {
    color: webTokens.color.bad,
    fontWeight: '700',
    fontSize: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  stat: {
    minWidth: 120,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    color: webTokens.color.ink,
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    color: webTokens.color.muted,
    marginTop: 3,
    fontWeight: '800',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 28,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: webTokens.color.ink,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    color: webTokens.color.muted,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 21,
  },
  loading: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: webTokens.color.muted,
    fontWeight: '800',
  },
  subjectImage: {
    width: '100%',
    height: 190,
    backgroundColor: webTokens.color.surfaceAlt,
  },
});
