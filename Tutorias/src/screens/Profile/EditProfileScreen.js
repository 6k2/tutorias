import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import AvatarPicker from '../../components/AvatarPicker';
import { auth } from '../../services/firebase';
import { getCurrentUserDoc, updateUserProfile } from '../../services/userService';
import { parseSpecialties } from '../../utils/formatters';
import { isRequired, maxLength, maxArrayLength } from '../../utils/validators';

export default function EditProfileScreen({ navigation }) {
  const uid = auth.currentUser?.uid;
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [role, setRole] = useState('student');
  const [specialtiesText, setSpecialtiesText] = useState('');
  const [localUri, setLocalUri] = useState(null);

  useEffect(() => {
    (async () => {
      const data = await getCurrentUserDoc(uid);
      if (data) {
        setDisplayName(data.displayName || '');
        setBio(data.bio || '');
        setRole(data.role);
        setSpecialtiesText((data.specialties || []).join(', '));
      }
    })();
  }, [uid]);

  const onSave = async () => {
    const specialties = parseSpecialties(specialtiesText);
    if (!isRequired(displayName)) {
      Alert.alert('Validation', 'Display name required');
      return;
    }
    if (!maxLength(bio, 200)) {
      Alert.alert('Validation', 'Bio too long');
      return;
    }
    if (role === 'tutor' && !maxArrayLength(specialties, 8)) {
      Alert.alert('Validation', 'Maximum 8 specialties');
      return;
    }
    try {
      await updateUserProfile(uid, { displayName, bio, specialties, localUri });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <AvatarPicker value={null} onPick={setLocalUri} />
      <TextInput placeholder="Name" value={displayName} onChangeText={setDisplayName} style={{ borderWidth: 1, marginVertical: 8, padding: 8 }} />
      <TextInput placeholder="Bio" value={bio} onChangeText={setBio} style={{ borderWidth: 1, marginVertical: 8, padding: 8 }} multiline />
      <Text>Role: {role}</Text>
      {role === 'tutor' && (
        <TextInput placeholder="Specialties (comma separated)" value={specialtiesText} onChangeText={setSpecialtiesText} style={{ borderWidth: 1, marginVertical: 8, padding: 8 }} />
      )}
      <Button title="Save" onPress={onSave} />
    </View>
  );
}
