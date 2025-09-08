import React, { useState } from 'react';
import { View, Image, Button } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function AvatarPicker({ value, onPick }) {
  const [uri, setUri] = useState(value);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) {
      const imageUri = result.assets[0].uri;
      setUri(imageUri);
      onPick(imageUri);
    }
  };

  return (
    <View style={{ alignItems: 'center' }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: 100, height: 100, borderRadius: 50 }} />
      ) : null}
      <Button title="Change Photo" onPress={pickImage} />
    </View>
  );
}
