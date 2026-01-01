// Copy Firebase config from main app
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDZK8DJd0nDvaoWvKFzJnExZoyRcHpWjv4",
  authDomain: "hungrimart.firebaseapp.com",
  databaseURL: "https://hungrimart-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hungrimart",
  storageBucket: "hungrimart.firebasestorage.app",
  messagingSenderId: "863073530050",
  appId: "1:863073530050:web:5e6ed98bbab3d525934b5b"
};

// Initialize Firebase with unique app name for delivery app
let app;
try {
  app = getApp('delivery-app');
} catch (error) {
  app = initializeApp(firebaseConfig, 'delivery-app');
}

// Initialize Realtime Database
export const db = getDatabase(app);

export default app;