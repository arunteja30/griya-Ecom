import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function OrderCard({ order, onPress }){
  if(!order) return null;
  return (
    <TouchableOpacity onPress={onPress} style={{ marginTop:8, borderWidth:1, borderColor:'#eee', padding:12, borderRadius:8, backgroundColor:'#fff' }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:6 }}>
        <Text style={{ fontWeight:'600' }}>Order #{order.id}</Text>
        <Text style={{ color:'#444' }}>{order.paymentType || ''} • ₹{order.amount || 0}</Text>
      </View>
      <Text style={{ color:'#666' }}>Pickup: {order.pickupAddress || '—'}</Text>
      <Text style={{ color:'#666', marginTop:4 }}>Drop: {order.dropAddress || '—'}</Text>
      <View style={{ marginTop:8, flexDirection:'row', justifyContent:'flex-end' }}>
        <Text style={{ color:'#1e90ff', fontWeight:'600' }}>View Details</Text>
      </View>
    </TouchableOpacity>
  );
}
