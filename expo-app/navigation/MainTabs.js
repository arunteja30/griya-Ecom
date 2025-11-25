import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import OrdersScreen from '../screens/OrdersScreen';
import EarningsScreen from '../screens/EarningsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OrderDetailsScreen from '../screens/OrderDetailsScreen';

const Tab = createBottomTabNavigator();
const OrdersStack = createNativeStackNavigator();

function OrdersStackScreen(){
  return (
    <OrdersStack.Navigator>
      <OrdersStack.Screen name="OrdersList" component={OrdersScreen} options={{ headerShown: false }} />
      <OrdersStack.Screen name="OrderDetails" component={OrderDetailsScreen} options={{ title: 'Order Details' }} />
    </OrdersStack.Navigator>
  );
}

export default function MainTabs(){
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Orders" component={OrdersStackScreen} />
      <Tab.Screen name="Earnings" component={EarningsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
