const { initializeApp } = require('firebase/app');
const { getDatabase, ref, push, set } = require('firebase/database');

// Firebase config (replace with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyDxhgUevqtN-fB5LUd8YYl7JiWlwhxCHQQ",
  authDomain: "griya-jewellery-2e6f1.firebaseapp.com",
  databaseURL: "https://griya-jewellery-2e6f1-default-rtdb.firebaseio.com",
  projectId: "griya-jewellery-2e6f1",
  storageBucket: "griya-jewellery-2e6f1.appspot.com",
  messagingSenderId: "779050793956",
  appId: "1:779050793956:web:2ecae7b6eac81e63ecfe8a"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Sample drivers data
const sampleDrivers = [
  {
    id: 'DEL001',
    name: 'Raj Kumar',
    phone: '+91 9876543210',
    email: 'raj@griya.com',
    vehicle: 'Bike',
    licenseNumber: 'DL01AB1234',
    status: 'available',
    password: 'delivery123',
    createdAt: new Date().toISOString()
  },
  {
    id: 'DEL002',
    name: 'Amit Singh',
    phone: '+91 9876543211',
    email: 'amit@griya.com',
    vehicle: 'Car',
    licenseNumber: 'DL02CD5678',
    status: 'busy',
    password: 'delivery123',
    createdAt: new Date().toISOString()
  },
  {
    id: 'DEL003',
    name: 'Suresh Sharma',
    phone: '+91 9876543212',
    email: 'suresh@griya.com',
    vehicle: 'Van',
    licenseNumber: 'DL03EF9012',
    status: 'offline',
    password: 'delivery123',
    createdAt: new Date().toISOString()
  }
];

// Sample merchants data
const sampleMerchants = [
  {
    id: 'MER001',
    name: 'Ravi Patel',
    storeName: 'Griya Main Store',
    phone: '+91 9876543220',
    email: 'ravi@griya.com',
    address: '123 Main Street, Mumbai, India',
    category: 'Jewellery',
    permissions: {
      products: true,
      categories: true,
      orders: true,
      analytics: false
    },
    status: 'active',
    password: 'merchant123',
    createdAt: new Date().toISOString()
  },
  {
    id: 'MER002',
    name: 'Priya Sharma',
    storeName: 'Griya Electronics',
    phone: '+91 9876543221',
    email: 'priya@griya.com',
    address: '456 Tech Park, Bangalore, India',
    category: 'Electronics',
    permissions: {
      products: true,
      categories: false,
      orders: true,
      analytics: true
    },
    status: 'active',
    password: 'merchant123',
    createdAt: new Date().toISOString()
  },
  {
    id: 'MER003',
    name: 'Vikram Reddy',
    storeName: 'Griya Fashion Hub',
    phone: '+91 9876543222',
    email: 'vikram@griya.com',
    address: '789 Fashion Street, Delhi, India',
    category: 'Fashion',
    permissions: {
      products: true,
      categories: true,
      orders: false,
      analytics: false
    },
    status: 'pending',
    password: 'merchant123',
    createdAt: new Date().toISOString()
  }
];

async function seedData() {
  try {
    console.log('🌱 Seeding sample data...');

    // Add drivers
    console.log('👥 Adding sample drivers...');
    for (const driver of sampleDrivers) {
      await push(ref(db, 'drivers'), driver);
    }

    // Add merchants
    console.log('🏪 Adding sample merchants...');
    for (const merchant of sampleMerchants) {
      await push(ref(db, 'merchants'), merchant);
    }

    console.log('✅ Sample data seeded successfully!');
    console.log('');
    console.log('🔑 Demo Credentials:');
    console.log('');
    console.log('📊 Admin Panel: admin@griya.com / admin123');
    console.log('');
    console.log('🚗 Delivery Partners:');
    sampleDrivers.forEach(driver => {
      console.log(`   ${driver.id}: ${driver.name} (${driver.vehicle})`);
    });
    console.log('   Password: delivery123');
    console.log('');
    console.log('🏪 Merchants:');
    sampleMerchants.forEach(merchant => {
      console.log(`   ${merchant.id}: ${merchant.name} (${merchant.storeName})`);
    });
    console.log('   Password: merchant123');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
  }
}

seedData();