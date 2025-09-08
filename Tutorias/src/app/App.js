import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import ViewProfileScreen from '../screens/Profile/ViewProfileScreen';
import EditProfileScreen from '../screens/Profile/EditProfileScreen';
import TutorsListScreen from '../screens/Tutors/TutorsListScreen';
import TutorDetailScreen from '../screens/Tutors/TutorDetailScreen';
import routes from './routes';
import { observeAuthState } from '../services/userService';

const Stack = createNativeStackNavigator();

function AppStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name={routes.TUTORS_LIST} component={TutorsListScreen} />
      <Stack.Screen name={routes.TUTOR_DETAIL} component={TutorDetailScreen} />
      <Stack.Screen name={routes.VIEW_PROFILE} component={ViewProfileScreen} />
      <Stack.Screen name={routes.EDIT_PROFILE} component={EditProfileScreen} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name={routes.LOGIN} component={LoginScreen} />
      <Stack.Screen name={routes.REGISTER} component={RegisterScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = observeAuthState(u => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return null;

  return (
    <NavigationContainer>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
