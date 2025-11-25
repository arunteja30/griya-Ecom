import React, { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { listenToCompletedOrdersForRider } from '../services/orderService';

function startOfTodayTs(){
  const d = new Date(); d.setHours(0,0,0,0); return d.getTime();
}
function startOfWeekTs(){
  const d = new Date(); // start week on Monday
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? 6 : day - 1); // days since Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0,0,0,0);
  return d.getTime();
}

export default function EarningsScreen(){
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({ today:0, week:0, total:0 });

  useEffect(()=>{
    if(!user) return;
    const unsub = listenToCompletedOrdersForRider(user.uid, (completed) => {
      const list = (completed || []).map(o => ({ ...o }));
      // normalize deliveredAt
      list.forEach(o => {
        if(!o.deliveredAt){
          const hist = Array.isArray(o.orderStatusHistory) ? o.orderStatusHistory.slice().reverse() : [];
          const delivered = hist.find(h => String(h.status).toUpperCase().includes('DELIVER'));
          if(delivered) o.deliveredAt = delivered.ts;
        }
      });
      // sort desc
      list.sort((a,b)=> (b.deliveredAt||0) - (a.deliveredAt||0));
      setOrders(list);

      // compute sums
      const sod = startOfTodayTs();
      const sow = startOfWeekTs();
      let today = 0, week = 0;
      list.forEach(o => {
        const ts = o.deliveredAt || 0;
        // Prefer explicit delivery fee from order fees object; fall back to deliveryFee or delivery_fee.
        const fee = Number(
          (o.fees && (o.fees.deliveryFee ?? o.fees.delivery_fee)) ?? o.deliveryFee ?? o.delivery_fee ?? 0
        ) || 0;
        if(ts >= sod) today += fee;
        if(ts >= sow) week += fee;
      });
      setSummary({ today, week, total: list.length });
    });
    return () => unsub();
  },[user]);

  const renderItem = ({ item }) => (
    <View style={{ padding:12, borderBottomWidth:1, borderColor:'#eee' }}>
      <Text style={{ fontWeight:'600' }}>Order #{item.id}</Text>
      <Text style={{ color:'#666', marginTop:4 }}>Delivered: {item.deliveredAt ? new Date(item.deliveredAt).toLocaleString() : '—'}</Text>
      <Text style={{ marginTop:6 }}>Earnings: ₹{Number(item.deliveryFee ?? item.delivery_fee ?? item.amount ?? 0).toFixed(2)}</Text>
    </View>
  );

  return (
    <View style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:18, fontWeight:'700', marginBottom:12 }}>Earnings</Text>

      <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:12 }}>
        <View style={{ flex:1, padding:12, backgroundColor:'#fff', borderRadius:8, marginRight:8, borderWidth:1, borderColor:'#f0f0f0' }}>
          <Text style={{ color:'#999', fontSize:12 }}>Today</Text>
          <Text style={{ fontSize:18, fontWeight:'600', marginTop:8 }}>₹{summary.today.toFixed(2)}</Text>
        </View>
        <View style={{ flex:1, padding:12, backgroundColor:'#fff', borderRadius:8, marginLeft:8, borderWidth:1, borderColor:'#f0f0f0' }}>
          <Text style={{ color:'#999', fontSize:12 }}>This Week</Text>
          <Text style={{ fontSize:18, fontWeight:'600', marginTop:8 }}>₹{summary.week.toFixed(2)}</Text>
        </View>
      </View>

      <View style={{ marginBottom:12 }}>
        <Text style={{ color:'#666' }}>Completed orders: <Text style={{ fontWeight:'600' }}>{summary.total}</Text></Text>
      </View>

      <FlatList data={orders} keyExtractor={i => String(i.id)} renderItem={renderItem} ListEmptyComponent={<Text style={{ color:'#666' }}>No completed orders yet.</Text>} />
    </View>
  );
}
