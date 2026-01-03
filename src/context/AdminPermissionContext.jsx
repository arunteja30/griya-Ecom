import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const AdminPermissionContext = createContext();

export const useAdminPermissions = () => {
  const context = useContext(AdminPermissionContext);
  if (!context) {
    throw new Error('useAdminPermissions must be used within an AdminPermissionProvider');
  }
  return context;
};

// Simple admin permission system
// In production, this should be stored in database with proper role management
const DEFAULT_ADMIN_PERMISSIONS = {
  siteSettings: true,
  analytics: true,
  categories: true,
  products: true,
  promocodes: true,
  home: true,
  banners: true,
  gallery: true,
  testimonials: true,
  theme: true,
  orders: true,
  drivers: true,
  merchants: true,
  deliveryPricing: true,
  merchantEarnings: true,
  seed: true
};

export const AdminPermissionProvider = ({ children }) => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState(DEFAULT_ADMIN_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // In a production system, you would fetch admin permissions from database
      // For now, we'll use default permissions for all authenticated admin users
      // You can extend this to check user roles from Firebase custom claims or database
      
      // Example of how to check custom claims (requires backend setup):
      // user.getIdTokenResult().then((idTokenResult) => {
      //   const claims = idTokenResult.claims;
      //   if (claims.admin) {
      //     setPermissions(claims.adminPermissions || DEFAULT_ADMIN_PERMISSIONS);
      //   } else {
      //     setPermissions({});
      //   }
      //   setLoading(false);
      // });

      // For now, all authenticated admin users get full permissions
      setPermissions(DEFAULT_ADMIN_PERMISSIONS);
      setLoading(false);
    } else {
      setPermissions({});
      setLoading(false);
    }
  }, [user]);

  const hasPermission = (permission) => {
    return Boolean(permissions[permission]);
  };

  const value = {
    permissions,
    hasPermission,
    loading
  };

  return (
    <AdminPermissionContext.Provider value={value}>
      {children}
    </AdminPermissionContext.Provider>
  );
};