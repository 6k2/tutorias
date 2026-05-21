import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { db } from '../config/firebase';
import { useTopAlert } from '../../components/TopAlert';
import { useTeacherOfferStatus } from '../../features/offers/useTeacherOfferStatus';
import {
  SubjectImage,
  WebBadge,
  WebButton,
  WebCard,
  WebShell,
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
  const offerStatus = useTeacherOfferStatus(session.user?.uid, webSubjects, { disabled: !isTeacher });

  const goMatricula = async (subject) => {
    if (!session.user) {
      topAlert.show('Debes iniciar sesión para crear una tutoría', 'info');
      router.push('/login');
      return;
    }
    if (!isTeacher) {
      topAlert.show('Solo docentes pueden crear tutorías', 'info');
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
      title="Clases disponibles"
      subtitle="Elige una materia para ver docentes, cupos y horarios. Si eres docente, crea tu clase directamente desde cada materia."
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
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>Materias disponibles</Text>
          <Text style={styles.sectionText}>Entra directo a las clases, revisa ofertas disponibles o crea la tuya como docente.</Text>
        </View>
        {isTeacher ? <WebBadge tone="green" icon="workspace-premium">Modo docente</WebBadge> : null}
      </View>

      <View style={styles.grid}>
        {webSubjects.map((subject, index) => (
          <WebCard key={subject.key} delay={60 * index} style={styles.subjectCard}>
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
                  style={styles.primaryAction}
                />
                {isTeacher && offerStatus.canCreate(subject.key) ? (
                  <WebButton
                    label="Crear clase"
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
    </WebShell>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
    flexWrap: 'wrap',
  },
  sectionCopy: {
    flex: 1,
    minWidth: 260,
  },
  sectionTitle: {
    color: webTokens.color.ink,
    fontSize: 28,
    fontWeight: '900',
  },
  sectionText: {
    color: webTokens.color.muted,
    marginTop: 6,
    lineHeight: 22,
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
    height: 190,
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
  primaryAction: {
    flex: 1,
    minWidth: 130,
  },
});
