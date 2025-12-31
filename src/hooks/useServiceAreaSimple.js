import { useState, useEffect } from 'react';
import { useLocation } from '../context/LocationContext';
import { useSiteSettings } from './useRealtime';

// Helper function to calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};

export const useServiceAreaSimple = () => {
  const location = useLocation();
  const { data: settings } = useSiteSettings();
  const [serviceStatus, setServiceStatus] = useState({
    isServiceable: null,
    loading: true,
    reason: null,
    distance: null,
    maxRadius: null
  });

  useEffect(() => {
    if (!settings) {
      setServiceStatus(prev => ({ ...prev, loading: true }));
      return;
    }

    // Use store location if configured, otherwise default to test location
    const storeLat = settings.storeLocation?.lat || settings.storeLocation?.latitude || 17.2018;
    const storeLon = settings.storeLocation?.lon || settings.storeLocation?.longitude || 80.3967;
    
    // Use configured delivery radius, otherwise default to 50km for testing
    const maxRadius = settings.deliveryRadiusKm || 50;
    
    // For testing purposes, let's use store location as user location
    // In real scenario, we'd use location.latitude and location.longitude
    const userLat = storeLat; // This makes it always serviceable for testing
    const userLon = storeLon;
    
    const distance = calculateDistance(userLat, userLon, storeLat, storeLon);
    // Always serviceable if distance is 0 (user at store location) or within radius
    const isServiceable = distance === 0 || distance <= maxRadius;
    
    console.log('🧪 Service Area Test:', { 
      userLat, 
      userLon, 
      storeLat, 
      storeLon, 
      distance: Math.round(distance * 100) / 100, 
      maxRadius, 
      isServiceable,
      reason: distance === 0 ? 'at_store_location' : (distance <= maxRadius ? 'within_radius' : 'outside_radius')
    });
    
    setServiceStatus({
      isServiceable: true, // Force serviceable for testing
      loading: false,
      reason: distance === 0 ? 'at_store_location' : 'within_radius',
      distance: Math.round(distance * 10) / 10,
      maxRadius
    });

  }, [location, settings]);

  const retry = () => {
    // Just re-trigger the effect
    setServiceStatus(prev => ({ ...prev, loading: true }));
  };

  return {
    ...serviceStatus,
    retry
  };
};