import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DeliveryLogin from './pages/DeliveryLogin';
import Dashboard from './pages/Dashboard';
import OrderDetails from './pages/OrderDetails';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import DeliveryHistory from './pages/DeliveryHistory';
import HelpSupport from './pages/HelpSupport';
import Earnings from './pages/Earnings';
import ProtectedRoute from './components/ProtectedRoute';
import ToastContainer from './components/ToastContainer';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-surface-50 to-surface-100">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<DeliveryLogin />} />
          
          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/order/:orderId" element={
            <ProtectedRoute>
              <OrderDetails />
            </ProtectedRoute>
          } />
          
          <Route path="/earnings" element={
            <ProtectedRoute>
              <Earnings />
            </ProtectedRoute>
          } />
          
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />

          <Route path="/profile/edit" element={
            <ProtectedRoute>
              <EditProfile />
            </ProtectedRoute>
          } />

          <Route path="/profile/history" element={
            <ProtectedRoute>
              <DeliveryHistory />
            </ProtectedRoute>
          } />

          <Route path="/profile/help" element={
            <ProtectedRoute>
              <HelpSupport />
            </ProtectedRoute>
          } />
          
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        
        <ToastContainer />
      </div>
    </Router>
  );
}

export default App;