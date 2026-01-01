// Test script to verify complete order notification flow
// Run this in browser console to test the flow

export const OrderFlowTest = {
  // Test customer order placement
  async testOrderPlacement() {
    const testOrder = {
      id: `TEST_ORDER_${Date.now()}`,
      items: [
        { id: 'prod_1', name: 'Test Product', quantity: 2, price: 50 }
      ],
      total: 100,
      address: {
        name: 'Test Customer',
        line1: '123 Test Street',
        city: 'Mumbai',
        phone: '9876543210'
      },
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // Add order to tracking
    if (window.addOrderToTracking) {
      window.addOrderToTracking(testOrder);
    }

    // Send notification to merchants (simulating order placement)
    await NotificationService.sendOrderNotification(testOrder);
    
    console.log('✅ Order placed and merchant notified:', testOrder.id);
    return testOrder.id;
  },

  // Test merchant acceptance
  async testMerchantAcceptance(orderId) {
    // Simulate merchant accepting order
    await NotificationService.sendCustomerNotification(
      '9876543210',
      orderId,
      'Order Confirmed!',
      `Your order #${orderId} has been confirmed and is being prepared.`
    );

    // Send to drivers
    await NotificationService.sendOrderToDrivers({
      id: orderId,
      total: 100,
      storeAddress: 'Test Store',
      shippingAddress: {
        fullAddress: '123 Test Street, Mumbai'
      }
    });

    console.log('✅ Merchant accepted order, customer and drivers notified');
  },

  // Test driver acceptance
  async testDriverAcceptance(orderId) {
    await NotificationService.sendCustomerNotification(
      '9876543210',
      orderId,
      'Driver Assigned!',
      `Your order #${orderId} has been assigned to delivery partner John Doe.`
    );

    console.log('✅ Driver accepted order, customer notified');
  },

  // Test delivery updates
  async testDeliveryUpdates(orderId) {
    const statuses = [
      { status: 'picked', title: 'Order Picked Up!', message: 'Your order has been picked up and is on its way.' },
      { status: 'in-transit', title: 'Out for Delivery!', message: 'Your order is out for delivery. ETA: 30 mins.' },
      { status: 'delivered', title: 'Order Delivered!', message: 'Your order has been successfully delivered!' }
    ];

    for (let i = 0; i < statuses.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      
      await NotificationService.sendCustomerNotification(
        '9876543210',
        orderId,
        statuses[i].title,
        statuses[i].message
      );

      console.log(`✅ ${statuses[i].status} status sent to customer`);
    }
  },

  // Run complete flow test
  async runCompleteFlow() {
    console.log('🚀 Starting complete order flow test...');
    
    try {
      // Step 1: Order placement
      const orderId = await this.testOrderPlacement();
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 2: Merchant acceptance
      await this.testMerchantAcceptance(orderId);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 3: Driver acceptance
      await this.testDriverAcceptance(orderId);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 4: Delivery updates
      await this.testDeliveryUpdates(orderId);

      console.log('🎉 Complete flow test finished successfully!');
      console.log('📱 Check the notification bell in the navbar for customer notifications');
      console.log('📦 Check the floating order tracker for order updates');
      
    } catch (error) {
      console.error('❌ Flow test failed:', error);
    }
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.OrderFlowTest = OrderFlowTest;
  
  // Auto-run test instructions
  console.log('Order Flow Test Available!');
  console.log('Run: OrderFlowTest.runCompleteFlow() to test the complete flow');
  console.log('Or run individual tests:');
  console.log('- OrderFlowTest.testOrderPlacement()');
  console.log('- OrderFlowTest.testMerchantAcceptance(orderId)');
  console.log('- OrderFlowTest.testDriverAcceptance(orderId)');
  console.log('- OrderFlowTest.testDeliveryUpdates(orderId)');
}