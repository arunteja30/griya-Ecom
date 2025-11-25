import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const colors = {
  ASSIGNED: '#f59e0b',
  ACCEPTED: '#06b6d4',
  REACHED_STORE: '#3b82f6',
  PICKED_UP: '#f97316',
  ON_THE_WAY: '#10b981',
  DELIVERED: '#16a34a',
  CANCELLED: '#ef4444'
};

export default function StatusBadge({ status }){
  const bg = colors[status] || '#9ca3af';
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}> 
      <Text style={styles.text}>{String(status || '').replace(/_/g,' ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal:8, paddingVertical:4, borderRadius:12 },
  text: { color:'white', fontWeight:'600', fontSize:12 }
});
