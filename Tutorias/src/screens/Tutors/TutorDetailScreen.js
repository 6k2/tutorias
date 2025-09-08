import React from 'react';
import { View, Text, Image } from 'react-native';
import SubjectTag from '../../components/SubjectTag';

export default function TutorDetailScreen({ route }) {
  const { tutor } = route.params;
  return (
    <View style={{ flex: 1, padding: 20, alignItems: 'center' }}>
      {tutor.photoURL ? <Image source={{ uri: tutor.photoURL }} style={{ width: 100, height: 100, borderRadius: 50 }} /> : null}
      <Text>{tutor.displayName}</Text>
      <Text>{tutor.bio}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
        {(tutor.specialties || []).map(s => (
          <SubjectTag key={s} label={s} />
        ))}
      </View>
    </View>
  );
}
