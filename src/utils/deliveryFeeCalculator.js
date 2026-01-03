/**
 * Delivery Fee Calculation Engine
 * Calculates delivery fees based on distance, time, weather, and surge pricing
 */

import { ref, get, onValue, off } from 'firebase/database';
import { db } from '../firebase';

// Cache for pricing config to avoid repeated Firebase calls
let cachedPricingConfig = null;
let configListeners = new Set();

// Default pricing configuration if database values are not available
const DEFAULT_PRICING = {
  deliveryFeeEnabled: true,
  globalFreeDelivery: false,
  useAdminOverride: false,
  adminOverrideFee: 0,
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
  },
  // Legacy fields for backward compatibility
  baseFee: 20,
  freeDeliveryThreshold: 300,
  perKmRates: [
    { maxKm: 3, rate: 0, label: '0-3 km (Free)' },
    { maxKm: 5, rate: 5, label: '3-5 km' },
    { maxKm: 10, rate: 8, label: '5-10 km' },
    { maxKm: 999, rate: 12, label: '10+ km' }
  ],
  surgeHours: [
    { start: '12:00', end: '14:00', multiplier: 1.5, label: 'Lunch Rush' },
    { start: '19:00', end: '22:00', multiplier: 2.0, label: 'Dinner Rush' }
  ],
  weatherSurge: {
    enabled: true,
    rainMultiplier: 1.3,
    stormMultiplier: 1.8
  }
};

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
 * Load pricing configuration from Firebase
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
 * Calculate distance-based delivery fee
 */
export function calculateDistanceFee(distance, perKmRates) {
  if (!distance || distance <= 0) return 0;

  // Find the appropriate rate tier
  for (const tier of perKmRates) {
    if (distance <= tier.maxKm) {
      if (tier.rate === 0) return 0; // Free delivery for short distances
      
      // Calculate fee for the distance
      const previousTier = perKmRates.find(t => t.maxKm < tier.maxKm);
      const freeDistance = previousTier ? previousTier.maxKm : 0;
      const chargeableDistance = Math.max(0, distance - freeDistance);
      
      return chargeableDistance * tier.rate;
    }
  }

  return 0;
}

/**
 * Check if current time falls within surge hours
 */
export function getSurgeMultiplier(surgeHours, currentTime = new Date()) {
  const timeString = currentTime.toTimeString().substring(0, 5); // HH:MM format
  
  for (const surge of surgeHours) {
    if (timeString >= surge.start && timeString <= surge.end) {
      return {
        multiplier: surge.multiplier,
        reason: surge.label
      };
    }
  }
  
  return { multiplier: 1, reason: null };
}

/**
 * Get weather-based surge multiplier
 * This would typically integrate with a weather API
 */
export function getWeatherSurge(weatherSurge, weatherCondition = 'clear') {
  if (!weatherSurge.enabled) {
    return { multiplier: 1, reason: null };
  }
  
  switch (weatherCondition.toLowerCase()) {
    case 'rain':
    case 'drizzle':
      return {
        multiplier: weatherSurge.rainMultiplier,
        reason: 'Rain surcharge'
      };
    case 'storm':
    case 'thunderstorm':
    case 'heavy rain':
      return {
        multiplier: weatherSurge.stormMultiplier,
        reason: 'Storm surcharge'
      };
    default:
      return { multiplier: 1, reason: null };
  }
}

/**
 * Main delivery fee calculation function
 */
export async function calculateDeliveryFee(params) {
  const {
    orderValue = 0,
    distance = 0,
    currentTime = new Date(),
    weatherCondition = 'clear',
    zoneId = null
  } = params;

  try {
    // Load pricing configuration
    const config = await loadPricingConfig();
    
    // Check admin controls first
    // 1. If delivery fees are globally disabled
    if (!config.deliveryFeeEnabled) {
      return {
        total: 0,
        breakdown: {
          baseFee: 0,
          distanceFee: 0,
          surgeMultiplier: 1,
          weatherMultiplier: 1,
          driverEarnings: 0,
          platformFee: 0
        },
        reasons: ['Delivery fees disabled by admin'],
        adminOverride: true
      };
    }
    
    // 2. If admin has set global free delivery
    if (config.globalFreeDelivery) {
      return {
        total: 0,
        breakdown: {
          baseFee: 0,
          distanceFee: 0,
          surgeMultiplier: 1,
          weatherMultiplier: 1,
          driverEarnings: 0,
          platformFee: 0
        },
        reasons: ['Free delivery promotion active'],
        adminOverride: true
      };
    }
    
    // 3. Check if scheduled free delivery is active
    if (config.freeDeliverySchedule?.enabled) {
      const now = new Date();
      const startDate = config.freeDeliverySchedule.startDate ? new Date(config.freeDeliverySchedule.startDate) : null;
      const endDate = config.freeDeliverySchedule.endDate ? new Date(config.freeDeliverySchedule.endDate) : null;
      
      if (startDate && endDate && now >= startDate && now <= endDate) {
        return {
          total: 0,
          breakdown: {
            baseFee: 0,
            distanceFee: 0,
            surgeMultiplier: 1,
            weatherMultiplier: 1,
            driverEarnings: 0,
            platformFee: 0
          },
          reasons: [config.freeDeliverySchedule.reason || 'Scheduled promotion'],
          adminOverride: true
        };
      }
    }
    
    // 4. If admin has set fixed override fee
    if (config.useAdminOverride && config.adminOverrideFee >= 0) {
      const overrideFee = config.adminOverrideFee;
      const driverEarnings = Math.round(overrideFee * (config.driverEarningsPercentage / 100));
      const platformFee = overrideFee - driverEarnings;
      
      return {
        total: overrideFee,
        breakdown: {
          baseFee: overrideFee,
          distanceFee: 0,
          surgeMultiplier: 1,
          weatherMultiplier: 1,
          driverEarnings,
          platformFee,
          distance: distance
        },
        reasons: ['Fixed delivery fee set by admin'],
        adminOverride: true,
        config: {
          freeDeliveryThreshold: config.freeDeliveryThreshold,
          driverEarningsPercentage: config.driverEarningsPercentage
        }
      };
    }

    // Proceed with normal calculation if no admin overrides
    // Check if order qualifies for free delivery
    if (orderValue >= config.freeDeliveryThreshold) {
      return {
        total: 0,
        breakdown: {
          baseFee: 0,
          distanceFee: 0,
          surgeMultiplier: 1,
          weatherMultiplier: 1,
          driverEarnings: 0,
          platformFee: 0
        },
        reasons: ['Free delivery (order above threshold)']
      };
    }

    // Calculate base fee
    let baseFee = config.baseFee;
    
    // Calculate distance-based fee
    const distanceFee = calculateDistanceFee(distance, config.perKmRates);
    
    // Calculate surge multiplier
    const surge = getSurgeMultiplier(config.surgeHours, currentTime);
    
    // Calculate weather surge
    const weather = getWeatherSurge(config.weatherSurge, weatherCondition);
    
    // Calculate total before multipliers
    const subtotal = baseFee + distanceFee;
    
    // Apply surge and weather multipliers
    const finalMultiplier = surge.multiplier * weather.multiplier;
    const totalFee = Math.round(subtotal * finalMultiplier);
    
    // Calculate driver earnings and platform fee
    const driverEarnings = Math.round(totalFee * (config.driverEarningsPercentage / 100));
    const platformFee = totalFee - driverEarnings;
    
    // Build reasons array
    const reasons = [];
    if (surge.reason) reasons.push(surge.reason);
    if (weather.reason) reasons.push(weather.reason);
    
    return {
      total: totalFee,
      breakdown: {
        baseFee,
        distanceFee,
        surgeMultiplier: surge.multiplier,
        weatherMultiplier: weather.multiplier,
        driverEarnings,
        platformFee,
        distance: distance
      },
      reasons,
      config: {
        freeDeliveryThreshold: config.freeDeliveryThreshold,
        driverEarningsPercentage: config.driverEarningsPercentage
      }
    };
    
  } catch (error) {
    console.error('Error calculating delivery fee:', error);
    
    // Fallback calculation
    return {
      total: config.baseFee,
      breakdown: {
        baseFee: config.baseFee,
        distanceFee: 0,
        surgeMultiplier: 1,
        weatherMultiplier: 1,
        driverEarnings: Math.round(config.baseFee * 0.8),
        platformFee: Math.round(config.baseFee * 0.2),
        distance: distance
      },
      reasons: ['Fallback pricing (calculation error)'],
      config: DEFAULT_PRICING
    };
  }
}

/**
 * Calculate driver earnings for a specific delivery
 */
export function calculateDriverEarnings(deliveryFee, distance, config) {
  const earnings = Math.round(deliveryFee * (config.driverEarningsPercentage / 100));
  const perKmEarnings = distance > 0 ? Math.round(earnings / distance) : 0;
  
  return {
    totalEarnings: earnings,
    perKmEarnings,
    platformFee: deliveryFee - earnings,
    distance
  };
}

/**
 * Estimate delivery fee for frontend display (without saving to database)
 */
export async function estimateDeliveryFee(orderValue, distance) {
  return await calculateDeliveryFee({
    orderValue,
    distance,
    currentTime: new Date(),
    weatherCondition: 'clear'
  });
}

/**
 * Get distance between two coordinates using Google Maps Distance Matrix API
 * This function should be called from your backend for security
 */
export async function calculateDistance(origin, destination) {
  // This is a placeholder - implement actual Google Maps API call
  // You should call this from your backend to keep API keys secure
  
  try {
    // For now, return a mock distance calculation
    // Replace with actual Google Maps Distance Matrix API call
    const mockDistance = Math.random() * 10 + 2; // 2-12 km range
    
    return {
      distance: mockDistance,
      duration: mockDistance * 3 + 10, // Rough estimate in minutes
      status: 'OK'
    };
  } catch (error) {
    console.error('Error calculating distance:', error);
    return {
      distance: 5, // Fallback distance
      duration: 25, // Fallback duration
      status: 'ERROR'
    };
  }
}

export default {
  calculateDeliveryFee,
  calculateDriverEarnings,
  estimateDeliveryFee,
  loadPricingConfig,
  calculateDistance,
  getSurgeMultiplier,
  getWeatherSurge
};