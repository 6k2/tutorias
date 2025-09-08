import React, { useEffect, useState } from 'react';
import { View, TextInput, FlatList, Text, TouchableOpacity, Image } from 'react-native';
import { listTutors } from '../../services/tutorService';
import routes from '../../app/routes';

export default function TutorsListScreen({ navigation }) {
  const [tutors, setTutors] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async (subjectText = '') => {
    const res = await listTutors({ subjectText });
    setTutors(res.items);
  };

  const onSearch = text => {
    setSearch(text);
    load(text);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity onPress={() => navigation.navigate(routes.TUTOR_DETAIL, { tutor: item })} style={{ padding: 12, borderBottomWidth: 1 }}>
      {item.photoURL ? <Image source={{ uri: item.photoURL }} style={{ width: 40, height: 40, borderRadius: 20 }} /> : null}
      <Text>{item.displayName}</Text>
      <Text>{(item.specialties || []).slice(0,3).join(', ')}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <TextInput placeholder="Search" value={search} onChangeText={onSearch} style={{ borderWidth: 1, marginBottom: 10, padding: 8 }} />
      <FlatList data={tutors} keyExtractor={item => item.id} renderItem={renderItem} />
    </View>
  );
}
