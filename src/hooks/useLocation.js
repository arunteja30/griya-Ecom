import { useState, useEffect } from 'react';

export const useLocation = () => {
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    address: null,
    city: null,
    pincode: null,
    loading: true,
    error: null
  });

  const getCurrentLocation = () => {
    setLocation(prev => ({ ...prev, loading: true, error: null }));
    
    if (!navigator.geolocation) {
      setLocation(prev => ({
        ...prev,
        loading: false,
        error: 'Geolocation is not supported by this browser.'
      }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        // For testing: Use store location coordinates instead of actual GPS
        const latitude = 17.2018;  // Store location
        const longitude = 80.3967; // Store location
        
        try {
          // Reverse geocoding to get address
          const response = await fetch(
            `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${import.meta.env.VITE_OPENCAGE_API_KEY || 'demo'}`
          );
          
          if (response.ok) {
            const data = await response.json();
            const result = data.results[0];
            
            setLocation({
              latitude,
              longitude,
              address: result?.formatted || null,
              city: result?.components?.city || result?.components?.town || result?.components?.village || null,
              pincode: result?.components?.postcode || result?.components?.postal_code || null,
              loading: false,
              error: null
            });
          } else {
            // Fallback without address
            setLocation({
              latitude,
              longitude,
              address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
              city: 'Unknown Location',
              pincode: null,
              loading: false,
              error: null
            });
          }
        } catch (error) {
          // Fallback without address
          setLocation({
            latitude,
            longitude,
            address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            city: 'Unknown Location',
            pincode: null,
            loading: false,
            error: null
          });
        }
      },
      (error) => {
        let errorMessage;
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
          default:
            errorMessage = 'An unknown error occurred.';
            break;
        }
        
        setLocation(prev => ({
          ...prev,
          loading: false,
          error: errorMessage
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes cache
      }
    );
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  return {
    ...location,
    refetch: getCurrentLocation
  };
};