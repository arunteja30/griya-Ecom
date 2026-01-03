import { ref, get, onValue, off } from 'firebase/database';
import { db } from '../firebase';

// Default merchant earnings configuration
const DEFAULT_MERCHANT_EARNINGS = {
  commissionPercentage: 15,
  deliveryFeeShare: 10,
  minimumPayout: 100,
  payoutSchedule: 'weekly',
  bonusEarnings: {
    enabled: false,
    orderVolumeBonus: 0,
    volumeThreshold: 100,
    qualityRating: 4.5,
    qualityBonus: 5
  },
  peakHourBonus: {
    enabled: false,
    hours: [
      { start: '12:00', end: '14:00', bonus: 10 },
      { start: '19:00', end: '22:00', bonus: 15 }
    ]
  },
  enabled: true
};

// Cache for merchant earnings configs
let cachedEarningsConfigs = new Map();
let earningsListeners = new Map();

/**
 * Subscribe to real-time merchant earnings configuration updates
 */
export function subscribeMerchantEarnings(merchantId, callback) {
  const earningsRef = ref(db, `/merchantEarnings/${merchantId}`);
  
  const unsubscribe = onValue(earningsRef, (snapshot) => {
    let config;
    if (snapshot.exists()) {
      config = { ...DEFAULT_MERCHANT_EARNINGS, ...snapshot.val() };
    } else {
      config = DEFAULT_MERCHANT_EARNINGS;
    }
    
    // Update cache
    cachedEarningsConfigs.set(merchantId, config);
    
    // Call the callback
    callback(config);
  });
  
  // Store the unsubscribe function
  if (!earningsListeners.has(merchantId)) {
    earningsListeners.set(merchantId, new Set());
  }
  earningsListeners.get(merchantId).add({ callback, unsubscribe });
  
  return () => {
    const listeners = earningsListeners.get(merchantId);
    if (listeners) {
      const listener = Array.from(listeners).find(l => l.callback === callback);
      if (listener) {
        listeners.delete(listener);
        off(earningsRef, 'value', listener.unsubscribe);
      }
    }
  };
}

/**
 * Load merchant earnings configuration
 */
export async function loadMerchantEarnings(merchantId) {
  // Return cached config if available
  if (cachedEarningsConfigs.has(merchantId)) {
    return cachedEarningsConfigs.get(merchantId);
  }
  
  try {
    const earningsRef = ref(db, `/merchantEarnings/${merchantId}`);
    const snapshot = await get(earningsRef);
    
    let config;
    if (snapshot.exists()) {
      config = { ...DEFAULT_MERCHANT_EARNINGS, ...snapshot.val() };
    } else {
      config = DEFAULT_MERCHANT_EARNINGS;
    }
    
    // Cache the config
    cachedEarningsConfigs.set(merchantId, config);
    return config;
  } catch (error) {
    console.error('Error loading merchant earnings:', error);
    return DEFAULT_MERCHANT_EARNINGS;
  }
}

/**
 * Calculate merchant earnings for an order
 */
export function calculateMerchantEarnings(orderData, earningsConfig) {
  const {
    total: orderValue = 0,
    deliveryFee = 0,
    createdAt,
    merchantId
  } = orderData;

  const config = earningsConfig || DEFAULT_MERCHANT_EARNINGS;
  
  // Base calculations
  const platformCommission = (orderValue * config.commissionPercentage) / 100;
  const deliveryFeeShare = (deliveryFee * config.deliveryFeeShare) / 100;
  
  // Base merchant earning (order value - commission + delivery share)
  let merchantEarning = orderValue - platformCommission + deliveryFeeShare;
  
  // Calculate peak hour bonus
  let peakHourBonus = 0;
  if (config.peakHourBonus.enabled) {
    const orderTime = new Date(createdAt);
    const timeString = orderTime.toTimeString().substring(0, 5); // HH:MM
    
    for (const peak of config.peakHourBonus.hours) {
      if (timeString >= peak.start && timeString <= peak.end) {
        peakHourBonus = (merchantEarning * peak.bonus) / 100;
        break;
      }
    }
  }
  
  const totalEarning = merchantEarning + peakHourBonus;
  
  return {
    orderValue,
    platformCommission,
    deliveryFee,
    deliveryFeeShare,
    baseEarning: merchantEarning,
    peakHourBonus,
    totalEarning,
    breakdown: {
      commissionRate: config.commissionPercentage,
      deliveryShareRate: config.deliveryFeeShare,
      isPeakHour: peakHourBonus > 0
    }
  };
}

/**
 * Calculate quality bonus based on merchant performance
 */
export function calculateQualityBonus(monthlyData, earningsConfig) {
  const {
    totalOrders = 0,
    averageRating = 0,
    totalEarnings = 0
  } = monthlyData;

  const config = earningsConfig?.bonusEarnings || DEFAULT_MERCHANT_EARNINGS.bonusEarnings;
  
  if (!config.enabled) {
    return {
      volumeBonus: 0,
      qualityBonus: 0,
      totalBonus: 0,
      eligible: false
    };
  }

  // Volume bonus for orders above threshold
  const extraOrders = Math.max(0, totalOrders - config.volumeThreshold);
  const volumeBonus = extraOrders * config.orderVolumeBonus;
  
  // Quality bonus for high rating
  let qualityBonus = 0;
  if (averageRating >= config.qualityRating) {
    qualityBonus = (totalEarnings * config.qualityBonus) / 100;
  }
  
  const totalBonus = volumeBonus + qualityBonus;
  
  return {
    volumeBonus,
    qualityBonus,
    totalBonus,
    eligible: totalOrders >= config.volumeThreshold || averageRating >= config.qualityRating,
    breakdown: {
      extraOrders,
      qualityRatingMet: averageRating >= config.qualityRating,
      thresholdMet: totalOrders >= config.volumeThreshold
    }
  };
}

/**
 * Check if merchant is eligible for payout
 */
export function isPayoutEligible(pendingAmount, earningsConfig) {
  return pendingAmount >= (earningsConfig?.minimumPayout || DEFAULT_MERCHANT_EARNINGS.minimumPayout);
}

/**
 * Get next payout date based on schedule
 */
export function getNextPayoutDate(payoutSchedule = 'weekly') {
  const now = new Date();
  const nextPayout = new Date(now);
  
  switch (payoutSchedule) {
    case 'daily':
      nextPayout.setDate(now.getDate() + 1);
      nextPayout.setHours(9, 0, 0, 0); // 9 AM next day
      break;
    case 'weekly':
      // Next Monday
      const daysUntilMonday = (8 - now.getDay()) % 7;
      nextPayout.setDate(now.getDate() + (daysUntilMonday || 7));
      nextPayout.setHours(9, 0, 0, 0);
      break;
    case 'monthly':
      // 1st of next month
      nextPayout.setMonth(now.getMonth() + 1, 1);
      nextPayout.setHours(9, 0, 0, 0);
      break;
    default:
      nextPayout.setDate(now.getDate() + 7);
  }
  
  return nextPayout;
}

/**
 * Format earnings display like Swiggy
 */
export function formatEarningsDisplay(earnings) {
  return {
    primary: `₹${earnings.totalEarning.toFixed(2)}`,
    secondary: earnings.peakHourBonus > 0 
      ? `+₹${earnings.peakHourBonus.toFixed(2)} peak bonus`
      : `₹${earnings.baseEarning.toFixed(2)} base`,
    commission: `-₹${earnings.platformCommission.toFixed(2)}`,
    deliveryShare: earnings.deliveryFeeShare > 0 
      ? `+₹${earnings.deliveryFeeShare.toFixed(2)} delivery`
      : null
  };
}