import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDZK8DJd0nDvaoWvKFzJnExZoyRcHpWjv4",
  authDomain: "hungrimart.firebaseapp.com",
  databaseURL: "https://hungrimart-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hungrimart",
  storageBucket: "hungrimart.firebasestorage.app",
  messagingSenderId: "863073530050",
  appId: "1:863073530050:web:5e6ed98bbab3d525934b5b"
};

// Initialize or reuse a named Firebase app for the merchant app
let app;
try {
  app = getApp('merchant-app');
} catch (e) {
  // If not initialised, create a new named app
  app = initializeApp(firebaseConfig, 'merchant-app');
}

// Export both database and auth
export const db = getDatabase(app);
export const auth = getAuth(app);

// Provide an async helper to get Auth only when needed to avoid
// registering the auth component during module evaluation.
export async function getAuthInstance() {
  return auth;
}

export default app;