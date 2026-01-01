// Development utilities for testing order tracking
export const DevUtils = {
  addSampleOrder() {
    const sampleOrder = {
      id: `TEST_${Date.now()}`,
      status: 'confirmed',
      total: 299,
      createdAt: new Date().toISOString(),
      items: [
        { id: 'prod_1', name: 'Fresh Apples', quantity: 2, price: 50 },
        { id: 'prod_2', name: 'Organic Milk', quantity: 1, price: 60 },
        { id: 'prod_3', name: 'Whole Wheat Bread', quantity: 1, price: 40 }
      ],
      address: {
        name: 'John Doe',
        line1: '123 Main Street',
        city: 'Mumbai',
        pincode: '400001',
        phone: '9876543210'
      }
    };

    if (window.addOrderToTracking) {
      window.addOrderToTracking(sampleOrder);
      console.log('Sample order added:', sampleOrder);
    } else {
      console.log('Order tracking not available');
    }
  },

  addMultipleOrders() {
    const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'in-transit'];
    
    statuses.forEach((status, index) => {
      setTimeout(() => {
        const order = {
          id: `ORDER_${Date.now()}_${index}`,
          status: status,
          total: 150 + (index * 50),
          createdAt: new Date(Date.now() - (index * 30 * 60 * 1000)).toISOString(), // 30 min intervals
          items: [
            { id: 'prod_' + index, name: `Product ${index + 1}`, quantity: 1, price: 100 + (index * 25) }
          ],
          address: {
            name: `Customer ${index + 1}`,
            line1: `${index + 1}23 Test Street`,
            city: 'Delhi',
            phone: `987654321${index}`
          }
        };

        if (window.addOrderToTracking) {
          window.addOrderToTracking(order);
        }
      }, index * 1000);
    });
  },

  simulateOrderProgress(orderId) {
    const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked', 'in-transit', 'delivered'];
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex >= statuses.length) {
        clearInterval(interval);
        return;
      }

      // Update status in localStorage
      const orders = JSON.parse(localStorage.getItem('activeOrders') || '[]');
      const orderIndex = orders.findIndex(o => o.id === orderId);
      
      if (orderIndex !== -1) {
        orders[orderIndex].status = statuses[currentIndex];
        orders[orderIndex].lastUpdated = new Date().toISOString();
        localStorage.setItem('activeOrders', JSON.stringify(orders));
        
        // Trigger re-render by dispatching custom event
        try {
          window.dispatchEvent(new CustomEvent('activeOrdersUpdate', { 
            detail: { orderId, newStatus: statuses[currentIndex] }
          }));
        } catch (e) {
          console.log('Event dispatch failed:', e);
        }
      }

      currentIndex++;
    }, 3000); // Update every 3 seconds
  },

  clearAllOrders() {
    localStorage.removeItem('activeOrders');
    window.location.reload();
  }
};

// Make available globally for console testing
if (typeof window !== 'undefined') {
  window.DevUtils = DevUtils;
}