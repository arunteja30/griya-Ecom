import { ref, get, push, set, update } from 'firebase/database';
import { db } from './firebase';
import { isLocationServiceable, fallbackPincodeServiceable } from './utils/deliveryArea';
import { NotificationService } from './utils/notificationService';
import { InventoryService } from './utils/inventoryService';
import { loadMerchantEarnings, calculateMerchantEarnings } from './utils/merchantEarnings';

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
    // Check inventory availability before placing order (read-only check)
    if (order.items && order.items.length > 0) {
      try {
        console.log('Checking inventory for order items:', order.items);
        const inventoryCheck = await InventoryService.checkCartInventoryAvailability(order.items);
        
        if (!inventoryCheck.allAvailable) {
          const unavailableItems = inventoryCheck.unavailableItems
            .map(item => `${item.productName} (need: ${item.requestedQuantity}, available: ${item.availableStock})`)
            .join(', ');
          
          console.error('Inventory check failed:', inventoryCheck);
          return Promise.reject(new Error(`Some items are no longer available: ${unavailableItems}`));
        }
        
        console.log('Inventory availability check passed - proceeding with order creation');
        
      } catch (inventoryError) {
        console.error('Inventory check failed:', inventoryError);
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
    
    // Calculate merchant earnings for each merchant in the order
    let merchantEarnings = null;
    if (order.merchantId) {
      try {
        const earningsConfig = await loadMerchantEarnings(order.merchantId);
        merchantEarnings = calculateMerchantEarnings({
          total: order.total || 0,
          deliveryFee: order.deliveryFee || 0,
          createdAt: order.createdAt || new Date().toISOString(),
          merchantId: order.merchantId
        }, earningsConfig);
      } catch (earningsError) {
        console.error('Error calculating merchant earnings:', earningsError);
        // Don't fail order creation if earnings calculation fails
      }
    }
    
    const orderData = {
      ...order,
      id: newRef.key,
      status: 'pending',
      createdAt: order.createdAt || new Date().toISOString(),
      merchantEarnings: merchantEarnings,
      merchantPaid: false // Track payout status
    };
    
    // Create the order first
    console.log('Creating order in database...');
    await set(newRef, orderData);
    console.log('Order created successfully:', newRef.key);
    
    // NOW decrement inventory after successful order creation
    if (order.items && order.items.length > 0) {
      try {
        console.log('Decrementing inventory after successful order creation...');
        const decrementResult = await InventoryService.decrementInventoryOnCheckout(order.items);
        
        if (!decrementResult.success) {
          console.error('Failed to decrement inventory after order creation:', decrementResult);
          
          // If some items failed to decrement, mark order with warning
          if (decrementResult.outOfStockCount > 0) {
            console.error('Stock became unavailable after order creation - updating order status');
            await update(newRef, { 
              status: 'stock_error',
              stockError: 'Items became out of stock after order creation',
              inventoryIssues: decrementResult.details.outOfStock
            });
          }
          
          if (decrementResult.failureCount > 0) {
            console.warn('Some inventory updates failed but order created successfully');
            await update(newRef, { 
              inventoryWarning: 'Some inventory updates failed',
              inventoryIssues: decrementResult.details.failures
            });
          }
        } else {
          console.log('Successfully decremented inventory for all items');
          await update(newRef, { inventoryUpdated: true });
        }
        
      } catch (inventoryError) {
        console.error('Critical error during inventory decrement after order creation:', inventoryError);
        // Mark the order with inventory error but don't fail the order creation
        try {
          await update(newRef, { 
            status: 'inventory_error',
            inventoryError: inventoryError.message,
            needsManualInventoryUpdate: true
          });
        } catch (updateError) {
          console.error('Failed to update order with inventory error status:', updateError);
        }
      }
    }
    
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
