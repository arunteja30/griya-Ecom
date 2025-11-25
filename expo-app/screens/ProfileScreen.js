import React from 'react';
import { View, Text, Button } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getAuth } from 'firebase/auth';
import { listenToRiderProfile } from '../services/riderService';

export default function ProfileScreen(){
  const { user, logout } = useAuth();
  const [rider, setRider] = React.useState(null);

  React.useEffect(()=>{
    if(!user) return;
    const unsub = listenToRiderProfile(user.uid, data => setRider(data));
    return () => unsub();
  },[user]);
  const auth = getAuth();
  return (
    <View style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:18, fontWeight:'bold' }}>{rider?.name || user?.displayName || 'Rider'}</Text>
      <Text style={{ marginTop:8 }}>{user?.email}</Text>
      <Text style={{ marginTop:8 }}>Phone: {rider?.phone || '—'}</Text>
      <Text style={{ marginTop:8 }}>Vehicle: {rider?.vehicleNumber || '—'}</Text>
      <Text style={{ marginTop:8 }}>Status: {rider?.isOnline ? 'Online' : 'Offline'}</Text>
      <View style={{ marginTop:16 }}>
        <Button title="Logout" onPress={()=>logout()} />
      </View>
    </View>
  );
}
