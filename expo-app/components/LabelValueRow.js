import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function LabelValueRow({ label, value, valueStyle }){
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, valueStyle]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical:8, borderBottomWidth:0, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  label: { color:'#666', fontSize:14 },
  value: { fontSize:14, fontWeight:'600', color:'#222' }
});
