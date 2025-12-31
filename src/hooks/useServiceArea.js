import { useState, useEffect, useContext } from 'react';
import { LocationContext } from '../context/LocationContext';
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

export const useServiceArea = () => {
  const location = useContext(LocationContext);
  const { data: settings } = useSiteSettings();
  const [serviceStatus, setServiceStatus] = useState({
    isServiceable: null,
    loading: true,
    reason: null,
    distance: null,
    maxRadius: null
  });

  useEffect(() => {
    const checkServiceability = () => {
      console.log('🔍 Checking serviceability...', { location, settings });
      
      // Quick manual test for your coordinates
      const testDistance = calculateDistance(17.2018, 80.3967, 18.2018, 79.3967);
      console.log('🧪 TEST: Distance between store (17.2018,80.3967) and user (18.2018,79.3967):', testDistance, 'km');
      
      // If location is still loading, keep status loading
      if (location?.loading || !settings) {
        console.log('⏳ Still loading...', { locationLoading: location?.loading, hasSettings: !!settings });
        setServiceStatus(prev => ({ ...prev, loading: true }));
        return;
      }

      // If location failed or not available
      if (location?.error || !location?.latitude || !location?.longitude) {
        console.log('❌ Location unavailable', { error: location?.error, lat: location?.latitude, lon: location?.longitude });
        setServiceStatus({
          isServiceable: false,
          loading: false,
          reason: 'location_unavailable',
          distance: null,
          maxRadius: null
        });
        return;
      }

      const userLat = location.latitude;
      const userLon = location.longitude;
      console.log('📍 User location:', { userLat, userLon });

      // Check radius-based delivery if store location is configured
      if (settings.storeLocation && settings.deliveryRadiusKm) {
        const storeLat = settings.storeLocation.lat || settings.storeLocation.latitude;
        const storeLon = settings.storeLocation.lon || settings.storeLocation.longitude;
        const maxRadius = Number(settings.deliveryRadiusKm);
        
        console.log('🏪 Store config:', { storeLat, storeLon, maxRadius, hasStoreLocation: !!settings.storeLocation, hasRadius: !!settings.deliveryRadiusKm });

        if (storeLat && storeLon && maxRadius > 0) {
          const distance = calculateDistance(userLat, userLon, storeLat, storeLon);
          console.log('📏 Distance calculation:', { distance, maxRadius, isWithinRange: distance <= maxRadius });
          console.log('🚨 FORCING SERVICE CHECK: This should show not serviceable if distance > radius');
          
          const isWithinRange = distance <= maxRadius;
          console.log(isWithinRange ? '✅ SERVICEABLE: Within radius' : '❌ NOT SERVICEABLE: Outside radius');
          
          setServiceStatus({
            isServiceable: isWithinRange,
            loading: false,
            reason: isWithinRange ? 'within_radius' : 'outside_radius',
            distance: Math.round(distance * 10) / 10,
            maxRadius
          });
          return;
        } else {
          console.log('🚫 Store config incomplete:', { hasStoreLat: !!storeLat, hasStoreLon: !!storeLon, hasValidRadius: maxRadius > 0 });
          // If store location is configured but incomplete, default to NOT serviceable for safety
          setServiceStatus({
            isServiceable: false,
            loading: false,
            reason: 'store_config_incomplete',
            distance: null,
            maxRadius: null
          });
          return;
        }
      } else {
        console.log('🚫 No radius config found:', { hasStoreLocation: !!settings.storeLocation, hasDeliveryRadius: !!settings.deliveryRadiusKm });
        // If no store location configured, check pincodes
      }
            setServiceStatus({
              isServiceable: false,
              loading: false,
              reason: 'outside_radius',
              distance: Math.round(distance * 10) / 10,
              maxRadius
            });
            return;
          }
        }
      }

      console.log('🗺️ No radius config, checking pincodes...', { pincodes: settings.serviceablePincodes, userPincode: location.pincode });

      // Check pincode-based delivery as fallback
      if (settings.serviceablePincodes && location.pincode) {
        const serviceablePincodes = Array.isArray(settings.serviceablePincodes) 
          ? settings.serviceablePincodes 
          : String(settings.serviceablePincodes).split(/[,\n]/).map(p => p.trim()).filter(Boolean);

        console.log('📮 Pincode check:', { serviceablePincodes, userPincode: location.pincode });

        const isServiceablePincode = serviceablePincodes.some(pincode => 
          String(pincode).trim() === String(location.pincode).trim()
        );

        console.log('✅ Pincode result:', { isServiceablePincode });

        setServiceStatus({
          isServiceable: isServiceablePincode,
          loading: false,
          reason: isServiceablePincode ? 'pincode_match' : 'pincode_not_serviceable',
          distance: null,
          maxRadius: null
        });
        return;
      }

      console.log('🌍 No service restrictions configured, allowing access');

      // No service area configured - default to serviceable only if explicitly no restrictions
      // For testing purposes, if ANY store location or radius is configured, we should enforce it
      if (!settings.storeLocation && !settings.deliveryRadiusKm && !settings.serviceablePincodes) {
        console.log('✅ No restrictions configured anywhere, defaulting to serviceable');
        setServiceStatus({
          isServiceable: true,
          loading: false,
          reason: 'no_restrictions',
          distance: null,
          maxRadius: null
        });
      } else {
        console.log('❌ Some restrictions configured but not properly set up, defaulting to NOT serviceable');
        setServiceStatus({
          isServiceable: false,
          loading: false,
          reason: 'incomplete_config',
          distance: null,
          maxRadius: null
        });
      }
    };

    checkServiceability();
  }, [location, settings]);

  const retry = () => {
    if (location?.refetch) {
      location.refetch();
    }
  };

  return {
    ...serviceStatus,
    retry
  };
};