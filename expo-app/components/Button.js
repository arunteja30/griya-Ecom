import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

export default function Button({ title, onPress, color = '#1e90ff', disabled = false, style }){
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.btn, { backgroundColor: disabled ? '#bdbdbd' : color }, style]}>
      <Text style={[styles.text, disabled && { opacity: 0.85 }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  text: {
    color: 'white',
    fontWeight: '600'
  }
});
