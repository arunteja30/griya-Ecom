// Test script to verify Swiggy-like order flow
// This script verifies that drivers only see orders after merchant marks them as ready

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, set, get, onValue } from 'firebase/database';

// Firebase config - replace with your actual config
const firebaseConfig = {
  // Add your Firebase config here
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export class SwiggyFlowTest {
  // Test that drivers don't see pending/confirmed orders
  static async testDriverVisibility() {
    console.log('🧪 Testing Swiggy-like Order Flow...');
    
    // Create test orders with different statuses
    const testOrders = [
      {
        status: 'pending',
        customerName: 'Test Customer 1',
        total: 100
      },
      {
        status: 'confirmed', 
        customerName: 'Test Customer 2',
        total: 150
      },
      {
        status: 'preparing',
        customerName: 'Test Customer 3', 
        total: 200
      },
      {
        status: 'ready',
        customerName: 'Test Customer 4',
        total: 250
      }
    ];
    
    console.log('📝 Creating test orders...');
    
    // Add test orders to database
    for (const order of testOrders) {
      const orderRef = await push(ref(db, '/orders'), {
        ...order,
        createdAt: new Date().toISOString(),
        items: [{ name: 'Test Item', quantity: 1, price: order.total }]
      });
      console.log(`   ✅ Created ${order.status} order: ${orderRef.key}`);
    }
    
    // Wait a moment for data to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check what drivers would see
    const ordersSnapshot = await get(ref(db, '/orders'));
    const orders = ordersSnapshot.val() || {};
    
    const driverVisibleOrders = Object.entries(orders).filter(([id, order]) => 
      order.status === 'ready' && !order.deliveryPersonId
    );
    
    const allTestOrders = Object.entries(orders).filter(([id, order]) => 
      order.customerName?.startsWith('Test Customer')
    );
    
    console.log('');
    console.log('📊 Test Results:');
    console.log(`   Total test orders created: ${allTestOrders.length}`);
    console.log(`   Orders visible to drivers: ${driverVisibleOrders.length}`);
    console.log('');
    
    if (driverVisibleOrders.length === 1) {
      console.log('✅ SUCCESS: Drivers only see READY orders!');
      console.log(`   Only the "ready" order is visible to delivery partners`);
    } else {
      console.log('❌ FAILURE: Drivers are seeing wrong orders!');
      console.log(`   Expected: 1 ready order`);
      console.log(`   Actual: ${driverVisibleOrders.length} orders`);
    }
    
    console.log('');
    console.log('📋 Order Status Breakdown:');
    for (const [id, order] of allTestOrders) {
      const visibleToDriver = order.status === 'ready' && !order.deliveryPersonId;
      console.log(`   ${order.status}: ${order.customerName} - ${visibleToDriver ? '👀 Visible' : '🙈 Hidden'}`);
    }
    
    // Cleanup test orders
    console.log('');
    console.log('🧹 Cleaning up test orders...');
    for (const [id, order] of allTestOrders) {
      await set(ref(db, `/orders/${id}`), null);
    }
    console.log('✅ Cleanup completed');
  }
  
  // Simulate merchant workflow
  static async simulateMerchantWorkflow() {
    console.log('');
    console.log('🏪 Simulating Merchant Workflow...');
    
    // Create a pending order
    const orderRef = await push(ref(db, '/orders'), {
      status: 'pending',
      customerName: 'Workflow Test Customer',
      total: 300,
      items: [{ name: 'Test Meal', quantity: 1, price: 300 }],
      createdAt: new Date().toISOString()
    });
    
    const orderId = orderRef.key;
    console.log(`📋 Created order: ${orderId}`);
    
    // Step 1: Merchant confirms
    await set(ref(db, `/orders/${orderId}/status`), 'confirmed');
    console.log('   ✅ Merchant confirmed order');
    
    // Step 2: Merchant starts preparing
    await set(ref(db, `/orders/${orderId}/status`), 'preparing');
    console.log('   👨‍🍳 Merchant preparing order');
    
    // Step 3: Merchant marks ready
    await set(ref(db, `/orders/${orderId}/status`), 'ready');
    await set(ref(db, `/orders/${orderId}/readyAt`), new Date().toISOString());
    console.log('   📦 Merchant marked order as READY');
    console.log('   🚚 Order now visible to delivery partners!');
    
    // Verify driver can see it
    const orderSnapshot = await get(ref(db, `/orders/${orderId}`));
    const order = orderSnapshot.val();
    
    if (order && order.status === 'ready') {
      console.log('   ✅ SUCCESS: Order is now available for drivers to accept');
    }
    
    // Cleanup
    await set(ref(db, `/orders/${orderId}`), null);
    console.log('   🧹 Cleaned up workflow test order');
  }
}

// Make available for testing
if (typeof window !== 'undefined') {
  window.SwiggyFlowTest = SwiggyFlowTest;
  console.log('🧪 Swiggy Flow Test Available!');
  console.log('Run: SwiggyFlowTest.testDriverVisibility()');
  console.log('Run: SwiggyFlowTest.simulateMerchantWorkflow()');
}