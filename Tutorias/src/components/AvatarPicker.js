import React, { useState } from 'react';
import { View, Image, Button, Platform, ImagePickerIOS } from 'react-native';

export default function AvatarPicker({ value, onPick }) {
  const [uri, setUri] = useState(value);

  const pickImage = () => {
    if (Platform.OS === 'ios') {
      ImagePickerIOS.openSelectDialog({}, imageUri => {
        setUri(imageUri);
        onPick(imageUri);
      }, error => console.log(error));
    } else {
      // Android support not implemented to avoid extra deps
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
