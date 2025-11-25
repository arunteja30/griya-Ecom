import React, { useEffect, useState } from 'react';
import { View, Text, Linking, Alert } from 'react-native';
import { listenToOrder, updateOrderStatus, acceptOrder, rejectOrder, ORDER_STATUSES } from '../services/orderService';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';
import LabelValueRow from '../components/LabelValueRow';
import StatusBadge from '../components/StatusBadge';

export default function OrderDetailsScreen({ route, navigation }){
  const { orderId } = route.params || {};
  const [order, setOrder] = useState(null);
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(()=>{
    if(!orderId) return;
    const unsub = listenToOrder(orderId, data => setOrder(data));
    return () => unsub();
  },[orderId]);

  if(!order) return (
    <View style={{ flex:1, padding:16 }}><Text>Loading…</Text></View>
  );

  const openMaps = (lat, lng, label) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => Alert.alert('Unable to open maps'));
  };

  const callCustomer = (phone) => {
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Unable to call'));
  };

  const onNext = async () => {
    const status = order.status;
    try{
      setBusy(true);
      if(status === ORDER_STATUSES.ASSIGNED){
        // accept as current authenticated rider
        const riderId = user?.uid || order.riderId || null;
        await acceptOrder(orderId, riderId);
      }else if(status === ORDER_STATUSES.ACCEPTED){
        await updateOrderStatus(orderId, ORDER_STATUSES.REACHED_STORE);
      }else if(status === ORDER_STATUSES.REACHED_STORE){
        await updateOrderStatus(orderId, ORDER_STATUSES.PICKED_UP);
      }else if(status === ORDER_STATUSES.PICKED_UP){
        await updateOrderStatus(orderId, ORDER_STATUSES.ON_THE_WAY);
      }else if(status === ORDER_STATUSES.ON_THE_WAY){
        // confirm deliver
        const ok = await new Promise(res => {
          const ans = confirm && typeof confirm === 'function';
          if(ans){ res(confirm('Mark order as delivered?')); }
          else res(true);
        });
        if(!ok){ setBusy(false); return; }
        await updateOrderStatus(orderId, ORDER_STATUSES.DELIVERED, { deliveredAt: Date.now() });
      }
      setBusy(false);
    }catch(e){
      console.error(e);
      Alert.alert('Failed to update status');
      setBusy(false);
    }
  };

  const onReject = async () => {
    try{
      setBusy(true);
      await rejectOrder(orderId, order.riderId || null);
      navigation.goBack();
      setBusy(false);
    }catch(e){ console.error(e); Alert.alert('Failed to reject'); }
  };

  return (
    <View style={{ flex:1, padding:16 }}>
      <Text style={{ fontWeight:'600', fontSize:18 }}>Order #{orderId}</Text>
      <View style={{ marginTop:8, alignItems:'flex-start' }}>
        <StatusBadge status={order.status} />
      </View>

      <View style={{ marginTop:12 }}>
        <LabelValueRow label="Pickup" value={order.pickupAddress} />
        {order.pickupLocation && <Button title="Open in Maps" onPress={() => openMaps(order.pickupLocation.lat, order.pickupLocation.lng)} style={{ marginTop:8 }} />}
      </View>

      <View style={{ marginTop:12 }}>
        <LabelValueRow label="Drop" value={order.dropAddress} />
        {order.dropLocation && <Button title="Open in Maps" onPress={() => openMaps(order.dropLocation.lat, order.dropLocation.lng)} style={{ marginTop:8 }} />}
      </View>

      <View style={{ marginTop:12 }}>
        <LabelValueRow label="Customer" value={`${order.customerName} • ${order.customerPhone}`} />
        <Button title="Call Customer" onPress={() => callCustomer(order.customerPhone)} style={{ marginTop:8 }} />
      </View>

      <View style={{ marginTop:12 }}>
        <LabelValueRow label="Items" value={(order.orderItems || []).map(i=>`${i.name} x${i.qty}`).join(', ') || '—'} />
      </View>

      <View style={{ marginTop:12 }}>
        <LabelValueRow label="Payment" value={`${order.paymentType} • ₹${order.amount}`} />
      </View>

      <View style={{ marginTop:18, flexDirection:'row', justifyContent:'flex-start' }}>
        {busy && <Text style={{ marginRight:12 }}>Processing…</Text>}
        {order.status === ORDER_STATUSES.ASSIGNED && (
          <>
            <Button title={busy ? 'Please wait...' : 'Accept'} disabled={busy} onPress={onNext} />
            <View style={{ width:12 }} />
            <Button title="Reject" color="red" disabled={busy} onPress={onReject} />
          </>
        )}
        {order.status !== ORDER_STATUSES.ASSIGNED && order.status !== ORDER_STATUSES.DELIVERED && (
          <Button title={busy ? 'Please wait...' : 'Next'} disabled={busy} onPress={onNext} />
        )}
      </View>
    </View>
  );
}
