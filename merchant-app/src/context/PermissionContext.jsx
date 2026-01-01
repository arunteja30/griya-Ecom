import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';

const PermissionContext = createContext();

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

export const PermissionProvider = ({ children }) => {
  const [merchant, setMerchant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get merchant data from localStorage
    const savedMerchant = localStorage.getItem('merchant');
    
    if (!savedMerchant) {
      setLoading(false);
      return;
    }

    try {
      const merchantData = JSON.parse(savedMerchant);
      const firebaseKey = merchantData.firebaseKey;
      
      if (!firebaseKey) {
        console.error('No firebaseKey found in merchant data');
        setLoading(false);
        return;
      }

      // Listen to merchant data changes using the Firebase auto-generated key
      const merchantRef = ref(db, `merchants/${firebaseKey}`);
      const unsubscribe = onValue(merchantRef, (snapshot) => {
        if (snapshot.exists()) {
          setMerchant(snapshot.val());
        } else {
          setMerchant(null);
        }
        setLoading(false);
      }, (error) => {
        console.error('Error loading merchant permissions:', error);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error parsing merchant data:', error);
      setLoading(false);
    }
  }, []);

  const hasPermission = (permission) => {
    return merchant?.permissions?.[permission] === true;
  };

  const hasAnyPermission = (permissions) => {
    return permissions.some(permission => hasPermission(permission));
  };

  const value = {
    merchant,
    loading,
    hasPermission,
    hasAnyPermission,
    permissions: merchant?.permissions || {}
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};

export default PermissionProvider;