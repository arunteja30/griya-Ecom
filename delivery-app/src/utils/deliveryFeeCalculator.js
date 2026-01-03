/**
 * Delivery Fee Calculation Engine
 * Load pricing configuration from Firebase with real-time updates
 */

import { ref, get, onValue, off } from 'firebase/database';
import { db } from '../firebase';

// Default pricing configuration if database values are not available
const DEFAULT_PRICING = {
  deliveryFeeEnabled: true,
  globalFreeDelivery: false,
  useAdminOverride: false,
  adminFeeOverride: 0,
  baseDeliveryFee: 40,
  feePerKm: 15,
  feePerKmAbove5: 20,
  minOrderForFreeDelivery: 500,
  driverEarningsPercentage: 80,
  freeDeliverySchedule: {
    enabled: false,
    startDate: '',
    endDate: '',
    reason: ''
  }
};

// Cache for pricing config to avoid repeated Firebase calls
let cachedPricingConfig = null;
let configListeners = new Set();

/**
 * Subscribe to real-time pricing configuration updates
 * This ensures admin changes reflect immediately across all apps
 */
export function subscribeToPricingConfig(callback) {
  const pricingRef = ref(db, '/deliveryPricing/default');
  
  const unsubscribe = onValue(pricingRef, (snapshot) => {
    let config;
    if (snapshot.exists()) {
      config = { ...DEFAULT_PRICING, ...snapshot.val() };
    } else {
      config = DEFAULT_PRICING;
    }
    
    // Update cache
    cachedPricingConfig = config;
    
    // Notify all subscribers
    configListeners.forEach(listener => {
      try {
        listener(config);
      } catch (error) {
        console.error('Error in pricing config listener:', error);
      }
    });
    
    // Call the specific callback
    callback(config);
  });
  
  // Add to listeners set for cleanup
  configListeners.add(callback);
  
  return () => {
    configListeners.delete(callback);
    off(pricingRef, 'value', unsubscribe);
  };
}

/**
 * Load pricing configuration from Firebase (one-time access)
 */
export async function loadPricingConfig() {
  // Return cached config if available
  if (cachedPricingConfig) {
    return cachedPricingConfig;
  }
  
  try {
    const pricingRef = ref(db, '/deliveryPricing/default');
    const snapshot = await get(pricingRef);
    
    let config;
    if (snapshot.exists()) {
      config = { ...DEFAULT_PRICING, ...snapshot.val() };
    } else {
      config = DEFAULT_PRICING;
    }
    
    // Cache the config
    cachedPricingConfig = config;
    return config;
  } catch (error) {
    console.error('Error loading pricing config:', error);
    return DEFAULT_PRICING;
  }
}

/**
 * Calculate driver earnings from delivery fee
 */
export function calculateDriverEarnings(deliveryFee, config = null) {
  const earningsPercentage = config?.driverEarningsPercentage || DEFAULT_PRICING.driverEarningsPercentage;
  return Math.round(deliveryFee * earningsPercentage / 100);
}

export default {
  loadPricingConfig
};