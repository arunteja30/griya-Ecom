// Firebase initialization (Modular SDK)
// Replace the placeholder strings below with your Firebase project values.
// You can obtain these from the Firebase console: Project settings -> General -> Your apps -> Config
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCLRgy0ARJBON5IPozXSUFyOw0SfI9MP6M",
  authDomain: "griya-jewellers.firebaseapp.com",
  databaseURL: "https://griya-jewellers-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "griya-jewellers",
  storageBucket: "griya-jewellers.firebasestorage.app",
  messagingSenderId: "902225299285",
  appId: "1:902225299285:web:4e32a1a8edcce11c1111dc",
  measurementId: "G-RCNXEX45K7"
};

// Initialize Firebase app, Realtime Database and Auth
export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

/*
Notes:
- Replace each <...> value with real credentials.
- Ensure your Realtime Database rules allow reads for your environment or implement authenticated reads:
  Example during development (NOT for production):
  {
    "rules": {
      ".read": true,
      ".write": false
    }
  }
- Store secrets (if any) in environment variables when deploying. This file uses plain placeholders only for local development.
*/
