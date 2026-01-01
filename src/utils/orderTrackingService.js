// Order tracking cleanup service
export class OrderTrackingService {
  static STORAGE_KEY = 'activeOrders';
  static CLEANUP_DELAY = 5000; // 5 seconds to show delivery status

  /**
   * Get active orders from localStorage
   */
  static getActiveOrders() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error loading orders from localStorage:', error);
      return [];
    }
  }

  /**
   * Save orders to localStorage
   */
  static saveActiveOrders(orders) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(orders));
    } catch (error) {
      console.error('Error saving orders to localStorage:', error);
    }
  }

  /**
   * Add order to tracking
   */
  static addOrder(order) {
    const orders = this.getActiveOrders();
    
    // Check if order already exists
    if (orders.find(o => o.id === order.id)) {
      return;
    }

    const orderToTrack = {
      id: order.id,
      status: order.status || 'pending',
      total: order.total,
      createdAt: order.createdAt,
      items: order.items?.slice(0, 3), // Store only first 3 items to save space
      address: {
        name: order.address?.name,
        line1: order.address?.line1,
        city: order.address?.city,
        phone: order.address?.phone
      },
      addedAt: new Date().toISOString()
    };

    orders.push(orderToTrack);
    this.saveActiveOrders(orders);
    
    return orderToTrack;
  }

  /**
   * Update order status
   */
  static updateOrderStatus(orderId, newStatus, orderData = null) {
    const orders = this.getActiveOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    
    if (orderIndex === -1) {
      return;
    }

    orders[orderIndex].status = newStatus;
    orders[orderIndex].lastUpdated = new Date().toISOString();
    
    // Update additional data if provided
    if (orderData) {
      Object.assign(orders[orderIndex], orderData);
    }

    // If delivered or cancelled, schedule for removal
    if (newStatus === 'delivered' || newStatus === 'cancelled') {
      orders[orderIndex].scheduleRemoval = Date.now() + this.CLEANUP_DELAY;
    }

    this.saveActiveOrders(orders);
    
    // Schedule cleanup for delivered orders
    if (newStatus === 'delivered' || newStatus === 'cancelled') {
      setTimeout(() => {
        this.removeOrder(orderId);
      }, this.CLEANUP_DELAY);
    }
  }

  /**
   * Remove order from tracking
   */
  static removeOrder(orderId) {
    const orders = this.getActiveOrders();
    const filteredOrders = orders.filter(o => o.id !== orderId);
    this.saveActiveOrders(filteredOrders);
  }

  /**
   * Cleanup old delivered orders
   */
  static cleanup() {
    const orders = this.getActiveOrders();
    const now = Date.now();
    
    const validOrders = orders.filter(order => {
      // Remove if scheduled for removal and time has passed
      if (order.scheduleRemoval && now > order.scheduleRemoval) {
        return false;
      }
      
      // Remove old delivered/cancelled orders (older than 1 hour)
      if ((order.status === 'delivered' || order.status === 'cancelled') &&
          order.lastUpdated) {
        const lastUpdate = new Date(order.lastUpdated).getTime();
        const oneHourAgo = now - (60 * 60 * 1000);
        return lastUpdate > oneHourAgo;
      }
      
      return true;
    });

    if (validOrders.length !== orders.length) {
      this.saveActiveOrders(validOrders);
    }
  }

  /**
   * Clear all orders
   */
  static clearAll() {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Initialize cleanup interval
   */
  static initCleanup() {
    // Run cleanup every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    // Run cleanup on page load
    this.cleanup();
  }
}