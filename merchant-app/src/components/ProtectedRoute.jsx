import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../context/PermissionContext';

const ProtectedRoute = ({ requiredPermission, children, fallback = null }) => {
  const { hasPermission, loading } = usePermissions();
  
  // Show loading state while permissions are being fetched
  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If no permission is required, allow access
  if (!requiredPermission) {
    return children;
  }

  // Check if merchant has the required permission
  if (!hasPermission(requiredPermission)) {
    if (fallback) {
      return fallback;
    }
    // Redirect to dashboard if no permission
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Component to show when access is denied
export const AccessDenied = ({ feature }) => (
  <div className="p-4">
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6 text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
      <p className="text-gray-600 mb-4">
        You don't have permission to access {feature}. Please contact your administrator to request access.
      </p>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-blue-800">
          <strong>Need access?</strong> Contact your store administrator to enable {feature} permissions for your account.
        </p>
      </div>
    </div>
  </div>
);

export default ProtectedRoute;