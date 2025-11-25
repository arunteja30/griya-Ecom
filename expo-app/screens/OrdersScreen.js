import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { listenToActiveOrdersForRider, listenToCompletedOrdersForRider } from '../services/orderService';
import OrderCard from '../components/OrderCard';
import { useNavigation } from '@react-navigation/native';

export default function OrdersScreen(){
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ongoing'); // 'ongoing' | 'completed'
  const [ongoing, setOngoing] = useState([]);
  const [completed, setCompleted] = useState([]);
  const navigation = useNavigation();

  useEffect(()=>{
    if(!user) return;
    setLoading(true);
    const unsubActive = listenToActiveOrdersForRider(user.uid, (orders) => {
      setOngoing(orders || []);
      setLoading(false);
    });
    const unsubCompleted = listenToCompletedOrdersForRider(user.uid, (orders) => {
      setCompleted(orders || []);
      setLoading(false);
    });
    return () => { try{ unsubActive(); }catch(e){} try{ unsubCompleted(); }catch(e){} };
  },[user]);

  const renderItem = ({ item }) => (
    <OrderCard order={item} onPress={() => navigation.navigate('OrderDetails', { orderId: item._key })} />
  );

  const currentData = tab === 'ongoing' ? ongoing : completed;

  return (
    <View style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:18, fontWeight:'600', marginBottom:12 }}>Orders</Text>

      <View style={{ flexDirection:'row', marginBottom:12 }}>
        <TouchableOpacity onPress={()=>setTab('ongoing')} style={{ flex:1, padding:10, borderRadius:8, backgroundColor: tab==='ongoing' ? '#1e90ff' : '#f0f0f0', marginRight:8 }}>
          <Text style={{ textAlign:'center', color: tab==='ongoing' ? 'white' : '#333' }}>Ongoing</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>setTab('completed')} style={{ flex:1, padding:10, borderRadius:8, backgroundColor: tab==='completed' ? '#1e90ff' : '#f0f0f0' }}>
          <Text style={{ textAlign:'center', color: tab==='completed' ? 'white' : '#333' }}>Completed</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator />
      ) : (
        currentData && currentData.length ? (
          <FlatList data={currentData} keyExtractor={item => item._key} renderItem={renderItem} ItemSeparatorComponent={() => <View style={{height:8}}/>} />
        ) : (
          <View style={{ padding:20 }}>
            <Text style={{ color:'#666' }}>{tab === 'ongoing' ? 'No ongoing orders.' : 'No completed orders yet.'}</Text>
          </View>
        )
      )}
    </View>
  );
}
