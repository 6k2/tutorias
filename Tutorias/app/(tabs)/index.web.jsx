import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useMemo, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { db } from '../config/firebase';
import { useTopAlert } from '../../components/TopAlert';
import {
  AnimatedScreen,
  SubjectImage,
  WebBadge,
  WebButton,
  WebCard,
  WebShell,
  WebStat,
  roleIsTeacher,
  useWebSession,
  webSubjects,
  webTokens,
} from '../../components/web/WebUI';

export default function WebHomeScreen() {
  const router = useRouter();
  const topAlert = useTopAlert();
  const session = useWebSession();
  const [checking, setChecking] = useState(null);
  const isTeacher = roleIsTeacher(session.role);

  const stats = useMemo(
    () => [
      { label: 'Materias activas', value: webSubjects.length, icon: 'auto-stories', tone: webTokens.color.brand },
      { label: 'Flujo completo', value: 'Web', icon: 'bolt', tone: webTokens.color.brand2 },
      { label: 'Reserva guiada', value: '24/7', icon: 'event-available', tone: webTokens.color.brand3 },
    ],
    []
  );

  const goMatricula = async (subject) => {
    if (!session.user) {
      topAlert.show('Debes iniciar sesión para publicar una tutoría', 'info');
      router.push('/login');
      return;
    }
    if (!isTeacher) {
      topAlert.show('Solo docentes pueden publicar tutorías', 'info');
      return;
    }
    setChecking(subject.key);
    try {
      const id = `${session.user.uid}_${subject.key}`;
      const snap1 = await getDoc(doc(db, 'offers', id));
      const snap2 = await getDoc(doc(db, 'users', session.user.uid, 'offers', subject.key));
      if (snap1.exists() || snap2.exists()) {
        topAlert.show('Ya tienes una tutoría creada para esta materia', 'info');
        return;
      }
      router.push(`/matricula/${encodeURIComponent(subject.key)}?name=${encodeURIComponent(subject.title)}`);
    } catch {
      router.push(`/matricula/${encodeURIComponent(subject.key)}?name=${encodeURIComponent(subject.title)}`);
    } finally {
      setChecking(null);
    }
  };

  return (
    <WebShell
      title="Panel de tutorías"
      subtitle="Una experiencia web limpia para encontrar docentes, reservar clases y mantener todo el seguimiento en un solo lugar."
      active="/"
      actions={
        !session.user ? (
          <>
            <WebButton label="Iniciar sesión" icon="login" variant="secondary" onPress={() => router.push('/login')} />
            <WebButton label="Crear cuenta" icon="person-add" onPress={() => router.push('/signup')} />
          </>
        ) : null
      }
    >
      <AnimatedScreen style={styles.hero}>
        <ImageBackground source={{ uri: webSubjects[1].image }} style={styles.heroImage} resizeMode="cover">
          <LinearGradient colors={['rgba(15,23,42,0.18)', 'rgba(15,23,42,0.82)']} style={styles.heroShade}>
            <View style={styles.heroCopy}>
              <WebBadge tone="blue" icon="rocket-launch">Nueva experiencia web</WebBadge>
              <Text style={styles.heroTitle}>Clases, agenda y chats con una interfaz que sí se siente actual.</Text>
              <Text style={styles.heroText}>
                Explora materias, revisa cupos, reserva horarios disponibles y conversa con tu docente sin perder contexto.
              </Text>
              <View style={styles.heroActions}>
                <WebButton label="Explorar materias" icon="travel-explore" onPress={() => router.push('/explore')} />
                <WebButton label="Ver agenda" icon="calendar-month" variant="secondary" onPress={() => router.push('/agenda')} />
              </View>
            </View>
            <View style={styles.heroStats}>
              {stats.map((item) => (
                <WebStat key={item.label} {...item} />
              ))}
            </View>
          </LinearGradient>
        </ImageBackground>
      </AnimatedScreen>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Materias disponibles</Text>
          <Text style={styles.sectionText}>Elige una ruta y entra al flujo completo de inspección, publicación o reserva.</Text>
        </View>
        {isTeacher ? <WebBadge tone="green" icon="workspace-premium">Modo docente</WebBadge> : null}
      </View>

      <View style={styles.grid}>
        {webSubjects.map((subject, index) => (
          <WebCard key={subject.key} delay={80 * index} style={styles.subjectCard}>
            <SubjectImage uri={subject.image} style={styles.subjectImage} />
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <WebBadge tone="gray">{subject.tag}</WebBadge>
                <View style={[styles.toneDot, { backgroundColor: subject.tone }]} />
              </View>
              <Text style={styles.cardTitle}>{subject.title}</Text>
              <Text style={styles.cardText}>Docentes, horarios, cupos y reserva en una vista optimizada para escritorio.</Text>
              <View style={styles.cardActions}>
                <WebButton
                  label="Ver clases"
                  icon="visibility"
                  onPress={() => router.push(`/inspect/${encodeURIComponent(subject.key)}?name=${encodeURIComponent(subject.title)}`)}
                  style={{ flex: 1 }}
                />
                {isTeacher ? (
                  <WebButton
                    label="Publicar"
                    icon="add"
                    variant="secondary"
                    loading={checking === subject.key}
                    onPress={() => goMatricula(subject)}
                  />
                ) : null}
              </View>
            </View>
          </WebCard>
        ))}
      </View>

      <AnimatedScreen delay={320}>
        <Pressable style={styles.flowCard} onPress={() => router.push('/profile')}>
          <View style={styles.flowIcon}>
            <MaterialIcons name="hub" size={30} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.flowTitle}>Tu flujo completo está conectado</Text>
            <Text style={styles.flowText}>Perfil, agenda, materiales y chats quedan listos para navegar desde la web.</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={24} color={webTokens.color.brand} />
        </Pressable>
      </AnimatedScreen>
    </WebShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 26,
    overflow: 'hidden',
    minHeight: 430,
    ...webTokens.shadow.lift,
  },
  heroImage: {
    flex: 1,
  },
  heroShade: {
    flex: 1,
    padding: 30,
    justifyContent: 'space-between',
    gap: 28,
  },
  heroCopy: {
    maxWidth: 760,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 56,
    lineHeight: 60,
    fontWeight: '900',
    marginTop: 18,
  },
  heroText: {
    color: '#EAF2FF',
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 720,
    marginTop: 14,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    flexWrap: 'wrap',
  },
  heroStats: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    color: webTokens.color.ink,
    fontSize: 28,
    fontWeight: '900',
  },
  sectionText: {
    color: webTokens.color.muted,
    marginTop: 6,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 18,
  },
  subjectCard: {
    padding: 0,
    overflow: 'hidden',
  },
  subjectImage: {
    height: 178,
  },
  cardBody: {
    padding: 18,
    gap: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toneDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  cardTitle: {
    color: webTokens.color.ink,
    fontSize: 25,
    fontWeight: '900',
  },
  cardText: {
    color: webTokens.color.muted,
    lineHeight: 21,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  flowCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: webTokens.color.line,
    borderRadius: 22,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    ...webTokens.shadow.soft,
  },
  flowIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: webTokens.color.brand,
  },
  flowTitle: {
    color: webTokens.color.ink,
    fontSize: 21,
    fontWeight: '900',
  },
  flowText: {
    color: webTokens.color.muted,
    marginTop: 4,
  },
});
