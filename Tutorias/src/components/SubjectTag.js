import React from 'react';
import { Text, View } from 'react-native';

export default function SubjectTag({ label }) {
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#eee', borderRadius: 12, marginRight: 4 }}>
      <Text>{label}</Text>
    </View>
  );
}
