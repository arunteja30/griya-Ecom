import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/AppNavigator';
import { AuthProvider } from './contexts/AuthContext';
import * as Notifications from 'expo-notifications';
import { addForegroundNotificationListener, addNotificationResponseListener } from './services/notificationService';

// Show notifications while app is foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App(){
  useEffect(() => {
    const subs = [];
    try{
      const s1 = addForegroundNotificationListener(() => {});
      const s2 = addNotificationResponseListener(() => {});
      subs.push(s1, s2);
    }catch(e){ console.error('notification listener error', e); }
    return () => {
      subs.forEach(s => { if(s && s.remove) s.remove(); });
    };
  }, []);

  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
