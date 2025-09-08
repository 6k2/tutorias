import React, { useEffect, useState } from 'react';
import { View, Text, Button, Image } from 'react-native';
import { auth } from '../../services/firebase';
import { getCurrentUserDoc } from '../../services/userService';
import { signOut } from '../../services/authService';
import routes from '../../app/routes';
import SubjectTag from '../../components/SubjectTag';

export default function ViewProfileScreen({ navigation }) {
  const uid = auth.currentUser?.uid;
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    (async () => {
      const data = await getCurrentUserDoc(uid);
      setProfile(data);
    })();
  }, [uid]);

  if (!profile) return null;

  return (
    <View style={{ flex: 1, padding: 20, alignItems: 'center' }}>
      {profile.photoURL ? <Image source={{ uri: profile.photoURL }} style={{ width: 100, height: 100, borderRadius: 50 }} /> : null}
      <Text>{profile.displayName}</Text>
      <Text>{profile.bio}</Text>
      <Text>{profile.role}</Text>
      {profile.role === 'tutor' && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
          {(profile.specialties || []).map(s => (
            <SubjectTag key={s} label={s} />
          ))}
        </View>
      )}
      <Button title="Editar perfil" onPress={() => navigation.navigate(routes.EDIT_PROFILE)} />
      <Button title="Cerrar sesión" onPress={async () => { await signOut(); navigation.replace(routes.LOGIN); }} />
    </View>
  );
}
