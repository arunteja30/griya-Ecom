import React, { useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen(){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { login } = useAuth();

  const onSubmit = async () => {
    setLoading(true); setError(null);
    try{
      await login(email, password);
    }catch(e){
      setError(e.message || 'Login failed');
    }finally{ setLoading(false); }
  };

  return (
    <View style={{ flex:1, justifyContent:'center', padding:20 }}>
      <Text style={{ fontSize:22, fontWeight:'bold', marginBottom:12 }}>Rider Login</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={{ borderWidth:1, padding:10, marginBottom:10 }}/>
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry style={{ borderWidth:1, padding:10, marginBottom:10 }}/>
      {error && <Text style={{ color:'red', marginBottom:10 }}>{error}</Text>}
      {loading ? <ActivityIndicator /> : <Button title="Login" onPress={onSubmit} />}
    </View>
  );
}
