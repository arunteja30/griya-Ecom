/**
 * Driver Location Tracker Component
 * Shows real-time driver location to customers during delivery
 */

import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';

export default function DriverLocationTracker({ orderId, driverFirebaseKey }) {
  const [driverLocation, setDriverLocation] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);

  useEffect(() => {
    if (!driverFirebaseKey) return;

    // Listen to driver location updates
    const driverRef = ref(db, `/drivers/${driverFirebaseKey}`);
    const unsubscribe = onValue(driverRef, (snapshot) => {
      if (snapshot.exists()) {
        const driverData = snapshot.val();
        setDriverLocation(driverData.location);
        setIsOnline(driverData.isOnline || false);
        setLastSeen(driverData.lastSeen);
      }
    });

    return () => unsubscribe();
  }, [driverFirebaseKey]);

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    const lastSeenTime = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now - lastSeenTime) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return lastSeenTime.toLocaleDateString();
  };

  const openInMaps = () => {
    if (!driverLocation) return;
    
    const { latitude, longitude } = driverLocation;
    const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    window.open(mapsUrl, '_blank');
  };

  if (!driverLocation) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center">
        <div className="w-8 h-8 mx-auto mb-2 bg-gray-200 rounded-full flex items-center justify-center">
          📍
        </div>
        <p className="text-sm text-gray-600">Driver location not available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">Delivery Partner Location</h3>
        <div className={`flex items-center gap-2 ${isOnline ? 'text-green-600' : 'text-gray-500'}`}>
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
          <span className="text-xs font-medium">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Last Updated:</span>
          <span className="text-gray-900">{formatLastSeen(driverLocation.timestamp)}</span>
        </div>
        
        {driverLocation.accuracy && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Accuracy:</span>
            <span className="text-gray-900">{Math.round(driverLocation.accuracy)}m</span>
          </div>
        )}

        <div className="pt-3 border-t border-gray-100">
          <button
            onClick={openInMaps}
            className="w-full bg-blue-50 text-blue-700 py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
          >
            📍 View on Map
          </button>
        </div>
      </div>

      {!isOnline && (
        <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
          <p className="text-xs text-yellow-700">
            ⚠️ Driver appears to be offline. Last seen {formatLastSeen(lastSeen)}
          </p>
        </div>
      )}
    </div>
  );
}