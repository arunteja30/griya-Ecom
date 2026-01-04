/**
 * Driver Earnings Utilities
 * Handles driver earnings calculations and updates
 */

import { ref, get, update } from 'firebase/database';
import { db } from '../firebase';

/**
 * Update driver earnings when an order is delivered
 * @param {string} driverFirebaseKey - Firebase key of the driver
 * @param {number} driverEarning - Amount to add to driver's earnings
 * @param {string} orderId - Order ID for tracking
 * @returns {Promise<boolean>} - Success status
 */
export async function updateDriverEarnings(driverFirebaseKey, driverEarning, orderId) {
  if (!driverFirebaseKey || !driverEarning || driverEarning <= 0) {
    console.warn('Invalid parameters for driver earnings update:', { driverFirebaseKey, driverEarning, orderId });
    return false;
  }

  try {
    // Get current driver data
    const driverRef = ref(db, `/drivers/${driverFirebaseKey}`);
    const driverSnapshot = await get(driverRef);
    const currentDriverData = driverSnapshot.val() || {};
    
    const currentEarnings = currentDriverData.earnings?.total || 0;
    const currentDeliveries = currentDriverData.stats?.totalDeliveries || 0;
    const timestamp = new Date().toISOString();
    
    const earningsUpdate = {
      [`/drivers/${driverFirebaseKey}/earnings/total`]: currentEarnings + driverEarning,
      [`/drivers/${driverFirebaseKey}/earnings/lastUpdated`]: timestamp,
      [`/drivers/${driverFirebaseKey}/stats/totalDeliveries`]: currentDeliveries + 1,
      [`/drivers/${driverFirebaseKey}/stats/lastDelivery`]: timestamp,
      [`/drivers/${driverFirebaseKey}/stats/lastOrderId`]: orderId
    };
    
    await update(ref(db), earningsUpdate);
    
    console.log('Driver earnings updated successfully:', { 
      orderId,
      driverEarning, 
      previousTotal: currentEarnings, 
      newTotal: currentEarnings + driverEarning,
      totalDeliveries: currentDeliveries + 1
    });
    
    return true;
  } catch (error) {
    console.error('Error updating driver earnings:', error);
    return false;
  }
}

/**
 * Calculate driver earning from delivery fee
 * @param {number} deliveryFee - Total delivery fee
 * @param {number} driverPercentage - Driver's percentage share (default 80)
 * @returns {number} - Driver's earning amount
 */
export function calculateDriverEarning(deliveryFee, driverPercentage = 80) {
  if (!deliveryFee || deliveryFee <= 0) return 0;
  return Math.round((deliveryFee * driverPercentage / 100) * 100) / 100; // Round to 2 decimal places
}

/**
 * Get driver earnings summary
 * @param {string} driverFirebaseKey - Firebase key of the driver
 * @returns {Promise<Object>} - Driver earnings data
 */
export async function getDriverEarnings(driverFirebaseKey) {
  try {
    const driverRef = ref(db, `/drivers/${driverFirebaseKey}`);
    const driverSnapshot = await get(driverRef);
    const driverData = driverSnapshot.val() || {};
    
    return {
      total: driverData.earnings?.total || 0,
      lastUpdated: driverData.earnings?.lastUpdated,
      totalDeliveries: driverData.stats?.totalDeliveries || 0,
      lastDelivery: driverData.stats?.lastDelivery,
      lastOrderId: driverData.stats?.lastOrderId
    };
  } catch (error) {
    console.error('Error fetching driver earnings:', error);
    return {
      total: 0,
      lastUpdated: null,
      totalDeliveries: 0,
      lastDelivery: null,
      lastOrderId: null
    };
  }
}

export default {
  updateDriverEarnings,
  calculateDriverEarning,
  getDriverEarnings
};