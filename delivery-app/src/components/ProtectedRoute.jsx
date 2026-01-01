import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const deliveryPerson = JSON.parse(localStorage.getItem('deliveryPerson') || '{}');

  if (!deliveryPerson.id) {
    return <Navigate to="/login" replace />;
  }

  return children;
}