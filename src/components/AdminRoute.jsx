import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// Simple admin route that requires an authenticated user. It does not verify custom claims client-side
// because custom claims require token refresh; for production additionally verify with a secure backend or check token claims after refresh.
export default function AdminRoute({ children }) {
  const { user, initializing } = useAuth();
  if (initializing) return null;
  if (!user) return <Navigate to="/admin/login" replace />;
  return children;
}
