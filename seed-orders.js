const { initializeApp } = require('firebase/app');
const { getDatabase, ref, push, set } = require('firebase/database');

// Firebase config 
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

// Sample orders data
const sampleOrders = [
  {
    orderNumber: 'ORD2026001',
    customerName: 'Amit Kumar',
    customerPhone: '+91 9876543210',
    customerEmail: 'amit@example.com',
    status: 'pending',
    total: 2500.00,
    items: [
      {
        id: '1',
        name: 'Gold Ring',
        price: 2500.00,
        quantity: 1,
        image: 'https://example.com/ring.jpg'
      }
    ],
    deliveryAddress: {
      street: '123 Main Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001'
    },
    paymentMethod: 'online',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    orderNumber: 'ORD2026002',
    customerName: 'Priya Sharma',
    customerPhone: '+91 9876543211',
    customerEmail: 'priya@example.com',
    status: 'confirmed',
    total: 1800.00,
    items: [
      {
        id: '2',
        name: 'Silver Necklace',
        price: 1800.00,
        quantity: 1,
        image: 'https://example.com/necklace.jpg'
      }
    ],
    deliveryAddress: {
      street: '456 Park Avenue',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001'
    },
    paymentMethod: 'cod',
    createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    updatedAt: new Date().toISOString()
  },
  {
    orderNumber: 'ORD2026003',
    customerName: 'Rajesh Patel',
    customerPhone: '+91 9876543212',
    customerEmail: 'rajesh@example.com',
    status: 'preparing',
    total: 4200.00,
    items: [
      {
        id: '3',
        name: 'Diamond Earrings',
        price: 2100.00,
        quantity: 2,
        image: 'https://example.com/earrings.jpg'
      }
    ],
    deliveryAddress: {
      street: '789 Commercial Street',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001'
    },
    paymentMethod: 'online',
    statusNote: 'Order is being prepared',
    merchantId: 'MER001',
    merchantName: 'Griya Main Store',
    createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    updatedAt: new Date(Date.now() - 1800000).toISOString() // 30 minutes ago
  },
  {
    orderNumber: 'ORD2026004',
    customerName: 'Sneha Reddy',
    customerPhone: '+91 9876543213',
    customerEmail: 'sneha@example.com',
    status: 'ready',
    total: 3500.00,
    items: [
      {
        id: '4',
        name: 'Gold Bracelet',
        price: 3500.00,
        quantity: 1,
        image: 'https://example.com/bracelet.jpg'
      }
    ],
    deliveryAddress: {
      street: '321 Tech Park',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500001'
    },
    paymentMethod: 'online',
    statusNote: 'Order is ready for pickup',
    merchantId: 'MER001',
    merchantName: 'Griya Main Store',
    createdAt: new Date(Date.now() - 14400000).toISOString(), // 4 hours ago
    updatedAt: new Date(Date.now() - 900000).toISOString() // 15 minutes ago
  },
  {
    orderNumber: 'ORD2026005',
    customerName: 'Vikram Singh',
    customerPhone: '+91 9876543214',
    customerEmail: 'vikram@example.com',
    status: 'rejected',
    total: 1200.00,
    items: [
      {
        id: '5',
        name: 'Silver Ring',
        price: 1200.00,
        quantity: 1,
        image: 'https://example.com/silver-ring.jpg'
      }
    ],
    deliveryAddress: {
      street: '654 Fashion Street',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001'
    },
    paymentMethod: 'cod',
    statusNote: 'Item out of stock',
    merchantId: 'MER001',
    merchantName: 'Griya Main Store',
    createdAt: new Date(Date.now() - 21600000).toISOString(), // 6 hours ago
    updatedAt: new Date(Date.now() - 18000000).toISOString() // 5 hours ago
  }
];

async function seedOrders() {
  try {
    console.log('🛒 Seeding sample orders...');

    for (const order of sampleOrders) {
      await push(ref(db, 'orders'), order);
    }

    console.log('✅ Sample orders seeded successfully!');
    console.log(`📦 Added ${sampleOrders.length} sample orders`);
    console.log('');
    console.log('Order statuses:');
    console.log('- Pending: Orders waiting for merchant approval');
    console.log('- Confirmed: Orders accepted by merchant');
    console.log('- Preparing: Orders being prepared');
    console.log('- Ready: Orders ready for pickup/delivery');
    console.log('- Rejected: Orders declined by merchant');

  } catch (error) {
    console.error('❌ Error seeding orders:', error);
  }
}

seedOrders();