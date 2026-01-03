import React, { useState, useEffect } from 'react';

export default function NewOrderAlert({ order, orderId, onAccept, onDecline, isVisible, pricingConfig }) {
  const [timeRemaining, setTimeRemaining] = useState(30); // 30 seconds to respond
  const [alertSound] = useState(new Audio('/notification-sound.mp3')); // You'll need to add this sound file

  useEffect(() => {
    if (isVisible && timeRemaining > 0) {
      // Play alert sound
      alertSound.play().catch(console.error);
      
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            onDecline(); // Auto decline after timeout
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isVisible, timeRemaining, alertSound, onDecline]);

  const formatINR = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const calculateEarnings = () => {
    const deliveryFee = order?.fees?.deliveryFeeApplied || order?.fees?.deliveryFee || order?.deliveryFee || 0;
    return deliveryFee * (pricingConfig?.driverEarningsPercentage || 80) / 100;
  };

  const calculatePerKmEarnings = () => {
    const earnings = calculateEarnings();
    const distance = order?.distance || 0;
    return distance > 0 ? earnings / distance : 0;
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Alert Modal */}
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-bounce">
        
        {/* Header with countdown */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 text-white text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl animate-pulse">🔔</span>
            <h2 className="text-lg font-bold">NEW ORDER ALERT!</h2>
          </div>
          <div className="mt-2">
            <div className="text-sm font-medium">Respond in</div>
            <div className="text-2xl font-bold">{timeRemaining}s</div>
          </div>
        </div>

        {/* Earnings Highlight - Most Prominent */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 px-6 py-6 text-white text-center">
          <div className="text-sm font-medium opacity-90 mb-1">YOUR EARNINGS</div>
          <div className="text-4xl font-black mb-2">{formatINR(calculateEarnings())}</div>
          {order?.distance > 0 && (
            <div className="text-lg font-semibold">
              {formatINR(calculatePerKmEarnings())}/km • {order.distance.toFixed(1)} km
            </div>
          )}
        </div>

        {/* Order Details */}
        <div className="px-6 py-4 space-y-3">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Order ID</div>
            <div className="text-lg font-bold text-gray-900">#{orderId?.slice(-6)}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Customer</div>
            <div className="font-semibold text-gray-900">{order?.address?.name || 'N/A'}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Delivery Address</div>
            <div className="text-sm text-gray-700 leading-relaxed">
              {order?.address?.line1}, {order?.address?.city} - {order?.address?.pincode}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Order Value</div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Total Amount</span>
              <span className="font-semibold">{formatINR(order?.total || 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Delivery Fee</span>
              <span className="font-semibold">{formatINR(order?.fees?.deliveryFeeApplied || 0)}</span>
            </div>
            {order?.paymentMethod === 'cod' && (
              <div className="mt-2 bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-1 rounded-full text-center">
                💰 Cash on Delivery
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 rounded-2xl transition-colors"
          >
            ❌ DECLINE
          </button>
          <button
            onClick={onAccept}
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 rounded-2xl transition-all transform hover:scale-105"
          >
            ✅ ACCEPT
          </button>
        </div>
      </div>
    </div>
  );
}