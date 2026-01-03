/**
 * Initialize delivery pricing configuration in Firebase
 * Run this script once to set up default pricing settings
 */

const { ref, set } = require('firebase/database');
const { initializeApp } = require('firebase/app');
const { getDatabase } = require('firebase/database');

// Firebase configuration (you'll need to add your config)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const defaultPricingConfig = {
  baseFee: 20,
  freeDeliveryThreshold: 300,
  driverEarningsPercentage: 80,
  // Admin delivery fee controls
  deliveryFeeEnabled: true,
  globalFreeDelivery: false,
  adminOverrideFee: 0,
  useAdminOverride: false,
  freeDeliverySchedule: {
    enabled: false,
    startDate: '',
    endDate: '',
    reason: 'Special Promotion'
  },
  conditionalFreeDelivery: {
    enabled: false,
    conditions: [
      { type: 'orderValue', value: 500, label: 'Orders above ₹500' },
      { type: 'timeRange', startTime: '18:00', endTime: '21:00', label: 'Evening hours' },
      { type: 'dayOfWeek', days: ['sunday'], label: 'Sundays' }
    ]
  },
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
  },
  lastUpdated: new Date().toISOString(),
  version: '1.0'
};

const defaultDeliveryZones = {
  zone1: {
    name: 'City Center',
    baseFee: 15,
    freeDeliveryThreshold: 250,
    maxDistance: 10,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  zone2: {
    name: 'Suburbs',
    baseFee: 25,
    freeDeliveryThreshold: 400,
    maxDistance: 20,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  zone3: {
    name: 'Outskirts',
    baseFee: 35,
    freeDeliveryThreshold: 500,
    maxDistance: 30,
    isActive: true,
    createdAt: new Date().toISOString()
  }
};

async function initializeDeliveryPricing() {
  try {
    console.log('Initializing delivery pricing configuration...');
    
    // Set default pricing configuration
    await set(ref(db, '/deliveryPricing/default'), defaultPricingConfig);
    console.log('✅ Default pricing configuration set');

    // Set delivery zones
    await set(ref(db, '/deliveryZones'), defaultDeliveryZones);
    console.log('✅ Default delivery zones set');

    // Set some sample pricing history for analytics
    const today = new Date().toISOString().split('T')[0];
    const samplePricingHistory = {
      [today]: {
        averageDeliveryFee: 28.5,
        totalDeliveries: 0,
        driverEarnings: 0,
        platformRevenue: 0
      }
    };
    
    await set(ref(db, '/deliveryPricing/history'), samplePricingHistory);
    console.log('✅ Sample pricing history initialized');

    console.log('\n🎉 Delivery pricing system initialized successfully!');
    console.log('\n📋 Configuration Summary:');
    console.log(`   Base delivery fee: ₹${defaultPricingConfig.baseFee}`);
    console.log(`   Free delivery threshold: ₹${defaultPricingConfig.freeDeliveryThreshold}+`);
    console.log(`   Driver earnings: ${defaultPricingConfig.driverEarningsPercentage}%`);
    console.log(`   Distance tiers: ${defaultPricingConfig.perKmRates.length} configured`);
    console.log(`   Surge periods: ${defaultPricingConfig.surgeHours.length} configured`);
    console.log(`   Delivery zones: ${Object.keys(defaultDeliveryZones).length} zones`);

    console.log('\n🔗 Next Steps:');
    console.log('   1. Access admin panel at /admin/delivery-pricing');
    console.log('   2. Customize pricing rules as needed');
    console.log('   3. Set up Google Maps API for distance calculations');
    console.log('   4. Test the pricing calculator with sample orders');

  } catch (error) {
    console.error('❌ Error initializing delivery pricing:', error);
    throw error;
  }
}

// Export for use in other scripts
module.exports = initializeDeliveryPricing;

// Run directly if this file is executed
if (require.main === module) {
  initializeDeliveryPricing()
    .then(() => {
      console.log('\n✨ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}