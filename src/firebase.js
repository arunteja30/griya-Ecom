// Firebase initialization (Modular SDK)
// Replace the placeholder strings below with your Firebase project values.
// You can obtain these from the Firebase console: Project settings -> General -> Your apps -> Config
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDZK8DJd0nDvaoWvKFzJnExZoyRcHpWjv4",
  authDomain: "hungrimart.firebaseapp.com",
  databaseURL: "https://hungrimart-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hungrimart",
  storageBucket: "hungrimart.firebasestorage.app",
  messagingSenderId: "863073530050",
  appId: "1:863073530050:web:5e6ed98bbab3d525934b5b"
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
