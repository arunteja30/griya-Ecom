import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { firebaseConfig } from '../firebaseConfig';
import { registerForPushNotificationsAsync, unregisterPushTokenForUid } from '../services/notificationService';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }){
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        try {
          await registerForPushNotificationsAsync(u.uid);
        } catch (e) {
          console.error('push registration error', e);
        }
      }
    });

    return () => unsub();
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);

  const logout = async () => {
    try {
      if (auth.currentUser && auth.currentUser.uid) {
        await unregisterPushTokenForUid(auth.currentUser.uid).catch(() => {});
      }
    } catch (e) {
      console.error('error unregistering token', e);
    }
    return signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
