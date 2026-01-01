import { ref, get, push, set } from 'firebase/database';
import { db } from './firebase';
import { isLocationServiceable, fallbackPincodeServiceable } from './utils/deliveryArea';
import { NotificationService } from './utils/notificationService';
import { InventoryService } from './utils/inventoryService';

// Return a promise that resolves to an array of categories: [{ id, ...data }, ...]
export async function getCategories() {
  try {
    const snap = await get(ref(db, 'categories'));
    if (!snap.exists()) return [];
    const val = snap.val();
    return Object.entries(val).map(([key, item]) => ({ id: key, ...item }));
  } catch (err) {
    return Promise.reject(err);
  }
}

// Return a promise that resolves to an array of products in a category
export async function getProductsByCategory(categoryId) {
  try {
    const snap = await get(ref(db, 'products'));
    if (!snap.exists()) return [];
    const val = snap.val();
    const out = [];
    for (const [key, p] of Object.entries(val)) {
      // accept either p.categoryId, p.category or p.categorySlug
      if (
        (p && (p.categoryId === categoryId || p.category === categoryId || p.categorySlug === categoryId)) ||
        key === categoryId
      ) {
        out.push({ id: key, ...p });
      } else if (p && String(p.categoryId) === String(categoryId)) {
        out.push({ id: key, ...p });
      }
    }
    // If no direct matches, try filtering by product.categoryId equals categoryId
    if (out.length === 0) {
      for (const [key, p] of Object.entries(val)) {
        if (p && String(p.categoryId) === String(categoryId)) {
          out.push({ id: key, ...p });
        }
      }
    }
    return out;
  } catch (err) {
    return Promise.reject(err);
  }
}

// Create an order under /orders and return the new key
export async function createOrder(order) {
  try {
    // Check inventory availability before placing order
    if (order.items && order.items.length > 0) {
      try {
        const inventoryCheck = await InventoryService.checkCartInventoryAvailability(order.items);
        
        if (!inventoryCheck.allAvailable) {
          const unavailableItems = inventoryCheck.unavailableItems
            .map(item => `${item.productName} (need: ${item.requestedQuantity}, available: ${item.availableStock})`)
            .join(', ');
          
          return Promise.reject(new Error(`Some items are no longer available: ${unavailableItems}`));
        }
        
        // Decrement inventory after confirming availability
        console.log('Decrementing inventory for order items:', order.items);
        const decrementResult = await InventoryService.decrementInventoryOnCheckout(order.items);
        
        if (!decrementResult.success) {
          console.error('Failed to decrement inventory:', decrementResult);
          
          // If some items failed to decrement, we should not proceed
          if (decrementResult.outOfStockCount > 0) {
            const outOfStockItems = decrementResult.details.outOfStock
              .map(item => `${item.productName} (requested: ${item.requestedQuantity}, available: ${item.availableStock})`)
              .join(', ');
            return Promise.reject(new Error(`Items became out of stock during order processing: ${outOfStockItems}`));
          }
          
          if (decrementResult.failureCount > 0) {
            // Log failures but continue - may be network issues
            console.warn('Some inventory updates failed but proceeding with order');
          }
        } else {
          console.log('Successfully decremented inventory for all items');
        }
        
      } catch (inventoryError) {
        console.error('Inventory processing failed:', inventoryError);
        return Promise.reject(new Error(`Inventory error: ${inventoryError.message}`));
      }
    }

    // Defensive serviceability check using geo fence or pincode
    try {
      const settingsSnap = await get(ref(db, 'siteSettings'));
      const siteSettings = settingsSnap.exists() ? settingsSnap.val() : null;
      if (siteSettings) {
        // Prefer geo coordinates if the client provided them (order.geo.lat/lon or order.address.lat/lon)
        const geoLat = order?.geo?.lat ?? order?.address?.lat ?? order?.address?.latitude ?? null;
        const geoLon = order?.geo?.lon ?? order?.address?.lon ?? order?.address?.longitude ?? null;
        let ok = true;
        if (geoLat !== null && geoLon !== null && typeof siteSettings?.deliveryRadiusKm !== 'undefined' && siteSettings?.storeLocation) {
          ok = isLocationServiceable(geoLat, geoLon, siteSettings);
        } else if (order?.address?.pincode) {
          ok = fallbackPincodeServiceable(order.address.pincode, siteSettings);
        }
        if (!ok) {
          return Promise.reject(new Error('Pincode/Location not serviceable'));
        }
      }
    } catch (e) {
      console.warn('Failed to perform serviceability check in createOrder:', e);
      // fail open: continue to save order
    }

    const ordersRef = ref(db, 'orders');
    const newRef = push(ordersRef);
    const orderData = {
      ...order,
      id: newRef.key,
      status: 'pending',
      createdAt: order.createdAt || new Date().toISOString()
    };
    
    await set(newRef, orderData);
    
    // Send notifications to merchants and drivers
    try {
      await NotificationService.sendOrderNotification({
        ...orderData,
        customer: {
          name: orderData.address?.name || 'Customer',
          phone: orderData.address?.phone || ''
        },
        storeAddress: 'Store Location', // You can get this from settings
        shippingAddress: {
          fullAddress: `${orderData.address?.line1}, ${orderData.address?.city}, ${orderData.address?.pincode}`
        }
      });
    } catch (notificationError) {
      console.error('Failed to send order notifications:', notificationError);
      // Don't fail the order creation if notifications fail
    }
    
    return { key: newRef.key, order: orderData };
  } catch (err) {
    return Promise.reject(err);
  }
}

// Create merchant-specific orders
export async function createMerchantOrders(merchantOrders) {
  try {
    const promises = merchantOrders.map(async (order) => {
      if (order.merchantId) {
        // Save to merchant-specific orders path
        const merchantOrdersRef = ref(db, `/merchantOrders/${order.merchantId}`);
        const newRef = push(merchantOrdersRef);
        const orderData = {
          ...order,
          id: newRef.key,
          status: 'pending',
          createdAt: order.createdAt || new Date().toISOString()
        };
        await set(newRef, orderData);
        return { success: true, orderId: newRef.key, merchantId: order.merchantId };
      } else {
        // Save to global orders path for items without merchant
        const globalOrdersRef = ref(db, '/orders');
        const newRef = push(globalOrdersRef);
        const orderData = {
          ...order,
          id: newRef.key,
          status: 'pending',
          createdAt: order.createdAt || new Date().toISOString()
        };
        await set(newRef, orderData);
        return { success: true, orderId: newRef.key, merchantId: 'global' };
      }
    });
    
    const results = await Promise.all(promises);
    console.log('Created merchant orders:', results);
    return results;
  } catch (err) {
    console.error('Error creating merchant orders:', err);
    return Promise.reject(err);
  }
}

export default {
  getCategories,
  getProductsByCategory,
  createOrder,
  createMerchantOrders
};
