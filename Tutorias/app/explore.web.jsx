import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SubjectImage, WebBadge, WebButton, WebCard, WebShell, webSubjects, webTokens } from '../components/web/WebUI';

export default function ExploreWebScreen() {
  const router = useRouter();
  return (
    <WebShell
      title="Explorar"
      subtitle="Todas las materias disponibles en la web, listas para inspeccionar o publicar tutorías."
      active="/explore"
    >
      <View style={styles.grid}>
        {webSubjects.map((subject, index) => (
          <WebCard key={subject.key} delay={index * 70} style={styles.card}>
            <SubjectImage uri={subject.image} style={styles.image} />
            <View style={styles.body}>
              <WebBadge tone="gray">{subject.tag}</WebBadge>
              <Text style={styles.title}>{subject.title}</Text>
              <Text style={styles.text}>Revisa docentes disponibles, cupos y horarios para esta materia.</Text>
              <WebButton label="Ver clases" icon="visibility" onPress={() => router.push(`/inspect/${encodeURIComponent(subject.key)}?name=${encodeURIComponent(subject.title)}`)} />
            </View>
          </WebCard>
        ))}
      </View>
    </WebShell>
  );
}

const styles = StyleSheet.create({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 },
  card: { padding: 0, overflow: 'hidden' },
  image: { height: 190 },
  body: { padding: 18, gap: 12 },
  title: { color: webTokens.color.ink, fontSize: 25, fontWeight: '900' },
  text: { color: webTokens.color.muted, lineHeight: 21 },
});
