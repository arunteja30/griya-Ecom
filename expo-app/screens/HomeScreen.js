import React, { useEffect, useState } from 'react';
import { View, Text, Switch } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { listenToRiderProfile, updateRiderStatus } from '../services/riderService';
import { listenToActiveOrdersForRider } from '../services/orderService';
import OrderCard from '../components/OrderCard';
import { useNavigation } from '@react-navigation/native';
import { startLocationTracking, stopLocationTracking } from '../services/locationService';
import Button from '../components/Button';
import LabelValueRow from '../components/LabelValueRow';

export default function HomeScreen(){
  const { user } = useAuth();
  const [rider, setRider] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [activeOrders, setActiveOrders] = useState([]);
  const navigation = useNavigation();

  useEffect(()=>{
    if(!user) return;
    const unsub = listenToRiderProfile(user.uid, data => {
      setRider(data);
      setIsOnline(data?.isOnline === true);
    });
    return () => unsub();
  },[user]);

  // subscribe to active orders for this rider
  useEffect(()=>{
    if(!user) return;
    const unsub = listenToActiveOrdersForRider(user.uid, (orders) => {
      setActiveOrders(orders || []);
    });
    return () => unsub();
  },[user]);

  // start/stop location tracking when online && active order
  useEffect(()=>{
    const hasActive = activeOrders && activeOrders.length > 0;
    if(isOnline && hasActive){
      startLocationTracking(user.uid, activeOrders[0]._key, (e)=>console.error('loc err', e));
    }else{
      stopLocationTracking();
    }
    // stop on unmount
    return () => stopLocationTracking();
  },[isOnline, activeOrders, user]);

  const toggle = async (val) => {
    setIsOnline(val);
    await updateRiderStatus(user.uid, { isOnline: val });
  };

  return (
    <View style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:20, fontWeight:'bold' }}>Hi, {rider?.name || 'Rider'}</Text>
      <View style={{ marginTop:12 }}>
        <LabelValueRow label="Status" value={isOnline ? 'Online' : 'Offline'} />
        <View style={{ marginTop:8 }}>
          <Button title={isOnline ? 'Go Offline' : 'Go Online'} onPress={() => toggle(!isOnline)} />
        </View>
      </View>
      <View style={{ marginTop:16 }}>
        <Text>{isOnline ? 'You are Online and available for orders' : 'You are Offline. Turn Online to receive orders.'}</Text>
      </View>

      <View style={{ marginTop:18 }}>
        <Text style={{ fontSize:16, fontWeight:'600' }}>Current Order</Text>
        {activeOrders && activeOrders.length > 0 ? (
          <OrderCard order={activeOrders[0]} onPress={() => navigation.navigate('OrderDetails', { orderId: activeOrders[0]._key })} />
        ) : (
          <Text style={{ marginTop:8, color:'#666' }}>No active orders. Please wait...</Text>
        )}
      </View>
    </View>
  );
}
