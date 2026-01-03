import React, { useState, useEffect } from 'react';
import { subscribeToPricingConfig } from '../utils/deliveryFeeCalculator';

/**
 * Real-time Pricing Test Component
 * This demonstrates that admin changes reflect immediately across apps
 */
export default function RealTimePricingTest() {
  const [pricingConfig, setPricingConfig] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToPricingConfig((config) => {
      setPricingConfig(config);
      setLastUpdated(new Date().toLocaleTimeString());
    });
    
    return unsubscribe;
  }, []);

  if (!pricingConfig) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <p>Loading pricing configuration...</p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="font-semibold text-lg mb-3">Live Pricing Configuration</h3>
      <p className="text-sm text-gray-600 mb-3">
        Last updated: {lastUpdated}
      </p>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="font-medium">Delivery Fee Enabled:</span>
          <span className={`ml-2 px-2 py-1 rounded text-xs ${
            pricingConfig.deliveryFeeEnabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {pricingConfig.deliveryFeeEnabled ? 'Yes' : 'No'}
          </span>
        </div>
        
        <div>
          <span className="font-medium">Global Free Delivery:</span>
          <span className={`ml-2 px-2 py-1 rounded text-xs ${
            pricingConfig.globalFreeDelivery ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {pricingConfig.globalFreeDelivery ? 'Active' : 'Inactive'}
          </span>
        </div>
        
        <div>
          <span className="font-medium">Admin Override:</span>
          <span className="ml-2">
            {pricingConfig.useAdminOverride ? `₹${pricingConfig.adminFeeOverride}` : 'Not active'}
          </span>
        </div>
        
        <div>
          <span className="font-medium">Driver Earnings:</span>
          <span className="ml-2">{pricingConfig.driverEarningsPercentage}%</span>
        </div>
        
        <div>
          <span className="font-medium">Base Fee:</span>
          <span className="ml-2">₹{pricingConfig.baseDeliveryFee}</span>
        </div>
        
        <div>
          <span className="font-medium">Free Delivery Minimum:</span>
          <span className="ml-2">₹{pricingConfig.minOrderForFreeDelivery}</span>
        </div>
      </div>
      
      {pricingConfig.freeDeliverySchedule.enabled && (
        <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded">
          <p className="text-sm font-medium text-amber-800">
            🎉 Scheduled Free Delivery: {pricingConfig.freeDeliverySchedule.reason}
          </p>
          <p className="text-xs text-amber-700 mt-1">
            {new Date(pricingConfig.freeDeliverySchedule.startDate).toLocaleString()} - {' '}
            {new Date(pricingConfig.freeDeliverySchedule.endDate).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}