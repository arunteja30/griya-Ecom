import { ref, get, update, runTransaction } from 'firebase/database';
import { db } from '../firebase';

export class InventoryService {
  /**
   * Decrement inventory when order is placed (customer checkout)
   * @param {Array} cartItems - Array of cart items with id and quantity
   * @returns {Promise<Object>} - Success status and details
   */
  static async decrementInventoryOnCheckout(cartItems) {
    try {
      const results = {
        success: [],
        failures: [],
        outOfStock: []
      };

      // Process each item in the cart
      for (const item of cartItems) {
        try {
          // Determine the correct path based on whether item is merchant-specific
          let productRef;
          if (item.merchantId || item._merchantSpecific) {
            productRef = ref(db, `/merchantProducts/${item.merchantId}/${item.id}`);
          } else {
            productRef = ref(db, `/products/${item.id}`);
          }
          
          // Use Firebase transaction to ensure atomic updates
          const result = await runTransaction(productRef, (currentProduct) => {
            if (currentProduct === null) {
              // Product doesn't exist
              return currentProduct;
            }

            const currentStock = currentProduct.stock || 0;
            const requestedQuantity = item.quantity || 1;

            // Check if sufficient stock is available
            if (currentStock < requestedQuantity) {
              // Don't update, return undefined to abort transaction
              return undefined;
            }

            // Decrement stock
            const newStock = currentStock - requestedQuantity;
            return {
              ...currentProduct,
              stock: newStock,
              inStock: newStock > 0,
              updatedAt: new Date().toISOString()
            };
          });

          if (result.committed) {
            results.success.push({
              productId: item.id,
              productName: item.name,
              quantityDeducted: item.quantity,
              newStock: result.snapshot.val()?.stock || 0
            });
          } else {
            // Transaction was aborted due to insufficient stock
            const currentData = await get(productRef);
            const currentProduct = currentData.val();
            
            results.outOfStock.push({
              productId: item.id,
              productName: item.name,
              requestedQuantity: item.quantity,
              availableStock: currentProduct?.stock || 0
            });
          }
        } catch (error) {
          console.error(`Error updating inventory for product ${item.id}:`, error);
          results.failures.push({
            productId: item.id,
            productName: item.name,
            error: error.message
          });
        }
      }

      return {
        success: results.success.length === cartItems.length,
        totalItems: cartItems.length,
        successCount: results.success.length,
        failureCount: results.failures.length,
        outOfStockCount: results.outOfStock.length,
        details: results
      };
    } catch (error) {
      console.error('Inventory decrement error:', error);
      throw new Error(`Failed to update inventory: ${error.message}`);
    }
  }

  /**
   * Check inventory availability for cart items
   * @param {Array} cartItems - Array of cart items with id and quantity
   * @returns {Promise<Object>} - Availability status
   */
  static async checkCartInventoryAvailability(cartItems) {
    try {
      const availabilityResults = [];

      for (const item of cartItems) {
        // Determine the correct path based on whether item is merchant-specific
        let productRef;
        if (item.merchantId || item._merchantSpecific) {
          productRef = ref(db, `/merchantProducts/${item.merchantId}/${item.id}`);
        } else {
          productRef = ref(db, `/products/${item.id}`);
        }
        
        const snapshot = await get(productRef);
        const product = snapshot.val();

        if (!product) {
          availabilityResults.push({
            productId: item.id,
            productName: item.name,
            available: false,
            reason: 'Product not found',
            requestedQuantity: item.quantity,
            availableStock: 0
          });
          continue;
        }

        const currentStock = product.stock || 0;
        const requestedQuantity = item.quantity || 1;

        availabilityResults.push({
          productId: item.id,
          productName: item.name,
          available: currentStock >= requestedQuantity && product.inStock !== false,
          reason: currentStock >= requestedQuantity 
            ? (product.inStock !== false ? 'Available' : 'Product marked as out of stock')
            : 'Insufficient stock',
          requestedQuantity: requestedQuantity,
          availableStock: currentStock,
          inStock: product.inStock
        });
      }

      const allAvailable = availabilityResults.every(item => item.available);

      return {
        allAvailable,
        items: availabilityResults,
        unavailableItems: availabilityResults.filter(item => !item.available)
      };
    } catch (error) {
      console.error('Inventory check error:', error);
      throw new Error(`Failed to check inventory: ${error.message}`);
    }
  }

  /**
   * Restore inventory (for failed payments or cancelled orders)
   * @param {Array} orderItems - Array of order items with id and quantity
   * @returns {Promise<Object>} - Restoration status
   */
  static async restoreInventory(orderItems) {
    try {
      const results = {
        success: [],
        failures: []
      };

      for (const item of orderItems) {
        try {
          // Determine the correct path based on whether item is merchant-specific
          let productRef;
          if (item.merchantId || item._merchantSpecific) {
            productRef = ref(db, `/merchantProducts/${item.merchantId}/${item.id}`);
          } else {
            productRef = ref(db, `/products/${item.id}`);
          }
          
          const result = await runTransaction(productRef, (currentProduct) => {
            if (currentProduct === null) {
              return currentProduct;
            }

            const currentStock = currentProduct.stock || 0;
            const restoreQuantity = item.quantity || 1;
            const newStock = currentStock + restoreQuantity;

            return {
              ...currentProduct,
              stock: newStock,
              inStock: newStock > 0,
              updatedAt: new Date().toISOString()
            };
          });

          if (result.committed) {
            results.success.push({
              productId: item.id,
              productName: item.name,
              quantityRestored: item.quantity,
              newStock: result.snapshot.val()?.stock || 0
            });
          }
        } catch (error) {
          console.error(`Error restoring inventory for product ${item.id}:`, error);
          results.failures.push({
            productId: item.id,
            productName: item.name,
            error: error.message
          });
        }
      }

      return {
        success: results.success.length === orderItems.length,
        totalItems: orderItems.length,
        successCount: results.success.length,
        failureCount: results.failures.length,
        details: results
      };
    } catch (error) {
      console.error('Inventory restoration error:', error);
      throw new Error(`Failed to restore inventory: ${error.message}`);
    }
  }

  /**
   * Get current stock level for a product
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} - Stock information
   */
  static async getProductStock(productId) {
    try {
      const productRef = ref(db, `/products/${productId}`);
      const snapshot = await get(productRef);
      const product = snapshot.val();

      if (!product) {
        return {
          exists: false,
          stock: 0,
          inStock: false
        };
      }

      return {
        exists: true,
        stock: product.stock || 0,
        inStock: product.inStock !== false && (product.stock || 0) > 0,
        productName: product.name
      };
    } catch (error) {
      console.error('Error fetching product stock:', error);
      throw new Error(`Failed to fetch stock for product ${productId}: ${error.message}`);
    }
  }
}