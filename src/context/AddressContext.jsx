import React, { createContext, useContext, useState, useEffect } from 'react';
import { checkServiceability } from '../utils/serviceAreaUtils';
import { useFirebaseObject } from '../hooks/useFirebase';

const AddressContext = createContext();

export const useAddress = () => {
  const context = useContext(AddressContext);
  if (!context) {
    throw new Error('useAddress must be used within an AddressProvider');
  }
  return context;
};

export const AddressProvider = ({ children }) => {
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [hasLocationAccess, setHasLocationAccess] = useState(null);
  const { data: siteSettings } = useFirebaseObject('/siteSettings');

  // Load addresses from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('deliveryAddresses');
    const selected = localStorage.getItem('selectedDeliveryAddress');
    
    if (saved) {
      try {
        const addresses = JSON.parse(saved);
        setSavedAddresses(addresses);
        
        if (selected) {
          const selectedAddr = JSON.parse(selected);
          setSelectedAddress(selectedAddr);
        } else if (addresses.length > 0) {
          // Auto-select first address if none selected
          setSelectedAddress(addresses[0]);
        }
      } catch (error) {
        console.error('Error loading addresses:', error);
      }
    }
  }, []);

  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    setLocationError(null);

    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setLocationError('Location services are not supported on this device. Please enter your address manually.');
      setIsGettingLocation(false);
      setHasLocationAccess(false);
      return null;
    }

    // Check if we're in a secure context (HTTPS)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      setLocationError('Location access requires a secure connection (HTTPS). Please enter your address manually.');
      setIsGettingLocation(false);
      setHasLocationAccess(false);
      return null;
    }

    try {
      // First check permissions if available
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({name: 'geolocation'});
        if (permission.state === 'denied') {
          setLocationError('Location access is blocked. Please enable location permissions in your browser settings or enter address manually.');
          setIsGettingLocation(false);
          setHasLocationAccess(false);
          return null;
        }
      }

      const position = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('TIMEOUT'));
        }, 15000); // Increased timeout to 15 seconds

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            clearTimeout(timeoutId);
            resolve(pos);
          },
          (err) => {
            clearTimeout(timeoutId);
            reject(err);
          },
          {
            enableHighAccuracy: false, // Use less accurate but faster location
            timeout: 10000,
            maximumAge: 300000 // Accept location up to 5 minutes old
          }
        );
      });

      const { latitude, longitude } = position.coords;
      
      // Validate coordinates
      if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
        throw new Error('Invalid location coordinates received');
      }
      
      // Use reverse geocoding to get address
      const address = await reverseGeocode(latitude, longitude);
      
      // Check if current location is serviceable
      const coordinates = { lat: latitude, lng: longitude };
      const serviceCheck = await checkServiceability(coordinates, siteSettings);
      
      if (!serviceCheck.isServiceable) {
        const message = serviceCheck.reason === 'outside_radius' 
          ? `Your current location is outside our delivery area (${serviceCheck.distance}km away, max ${serviceCheck.maxRadius}km)`
          : 'Your current location is not in our serviceable area';
        setLocationError(message + ' You can still enter a manual address within our service area.');
        setIsGettingLocation(false);
        return null;
      }
      
      setHasLocationAccess(true);
      setIsGettingLocation(false);
      
      return {
        ...address,
        coordinates,
        isCurrentLocation: true,
        serviceCheck: {
          isServiceable: serviceCheck.isServiceable,
          distance: serviceCheck.distance,
          checkedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Location error:', error);
      let errorMessage = 'Unable to detect your location.';
      let guidance = 'Please enter your address manually using the form below.';
      
      if (error.message === 'TIMEOUT') {
        errorMessage = 'Location detection is taking too long.';
        guidance = 'This might be due to poor GPS signal. Try moving to an area with better connectivity or enter your address manually.';
      } else if (error.code === 1) {
        errorMessage = 'Location access was denied.';
        guidance = 'Please enable location permissions in your browser settings, or enter your address manually.';
        setHasLocationAccess(false);
      } else if (error.code === 2) {
        errorMessage = 'Location information is currently unavailable.';
        guidance = 'This might be due to poor GPS signal or network connectivity. Please try again or enter your address manually.';
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out.';
        guidance = 'GPS signal might be weak. Try moving to an open area or enter your address manually.';
      } else if (error.message.includes('Invalid location coordinates')) {
        errorMessage = 'Received invalid location data.';
        guidance = 'Please try again or enter your address manually.';
      } else {
        errorMessage = 'An unexpected error occurred while detecting location.';
        guidance = 'Please enter your address manually.';
      }
      
      setLocationError(`${errorMessage} ${guidance}`);
      setIsGettingLocation(false);
      return null;
    }
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      // Using Nominatim (free) for reverse geocoding
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          signal: controller.signal,
          headers: {
            'User-Agent': 'GriyaEcom/1.0'
          }
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Geocoding service unavailable (${response.status})`);
      }
      
      const data = await response.json();
      
      if (data && data.address) {
        const addr = data.address;
        return {
          line1: `${addr.house_number || ''} ${addr.road || addr.neighbourhood || ''}`.trim(),
          city: addr.city || addr.town || addr.village || addr.county || '',
          pincode: addr.postcode || '',
          state: addr.state || '',
          country: addr.country || 'India',
          fullAddress: data.display_name || ''
        };
      }
      throw new Error('Address not found for this location');
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      
      if (error.name === 'AbortError') {
        console.warn('Reverse geocoding timed out, using fallback');
      }
      
      // Fallback address format with more user-friendly description
      return {
        line1: `Current Location`,
        city: 'Detected Location',
        pincode: '',
        state: '',
        country: 'India',
        fullAddress: `GPS Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
      };
    }
  };

  const saveCurrentLocationAsAddress = async (addressData) => {
    const newAddress = {
      id: Date.now().toString(),
      name: addressData.name || 'Current Location',
      phone: addressData.phone || '',
      ...addressData,
      type: addressData.type || 'current',
      createdAt: new Date().toISOString()
    };
    
    const updatedAddresses = [...savedAddresses, newAddress];
    setSavedAddresses(updatedAddresses);
    localStorage.setItem('deliveryAddresses', JSON.stringify(updatedAddresses));
    
    // Auto-select the new address
    setSelectedAddress(newAddress);
    localStorage.setItem('selectedDeliveryAddress', JSON.stringify(newAddress));
    
    return newAddress;
  };

  const saveAddress = (address) => {
    const newAddress = {
      id: Date.now().toString(),
      ...address,
      createdAt: new Date().toISOString()
    };
    
    const updatedAddresses = [...savedAddresses, newAddress];
    setSavedAddresses(updatedAddresses);
    localStorage.setItem('deliveryAddresses', JSON.stringify(updatedAddresses));
    
    // Auto-select the new address
    setSelectedAddress(newAddress);
    localStorage.setItem('selectedDeliveryAddress', JSON.stringify(newAddress));
    
    return newAddress;
  };

  const updateAddress = (addressId, updatedData) => {
    const updatedAddresses = savedAddresses.map(addr => 
      addr.id === addressId ? { ...addr, ...updatedData } : addr
    );
    setSavedAddresses(updatedAddresses);
    localStorage.setItem('deliveryAddresses', JSON.stringify(updatedAddresses));
    
    // Update selected address if it's the one being updated
    if (selectedAddress?.id === addressId) {
      const updatedSelected = { ...selectedAddress, ...updatedData };
      setSelectedAddress(updatedSelected);
      localStorage.setItem('selectedDeliveryAddress', JSON.stringify(updatedSelected));
    }
  };

  const deleteAddress = (addressId) => {
    const updatedAddresses = savedAddresses.filter(addr => addr.id !== addressId);
    setSavedAddresses(updatedAddresses);
    localStorage.setItem('deliveryAddresses', JSON.stringify(updatedAddresses));
    
    // Clear selected address if it's being deleted
    if (selectedAddress?.id === addressId) {
      const newSelected = updatedAddresses.length > 0 ? updatedAddresses[0] : null;
      setSelectedAddress(newSelected);
      if (newSelected) {
        localStorage.setItem('selectedDeliveryAddress', JSON.stringify(newSelected));
      } else {
        localStorage.removeItem('selectedDeliveryAddress');
      }
    }
  };

  const selectAddress = (address) => {
    setSelectedAddress(address);
    localStorage.setItem('selectedDeliveryAddress', JSON.stringify(address));
  };

  return (
    <AddressContext.Provider value={{
      savedAddresses,
      selectedAddress,
      isGettingLocation,
      locationError,
      hasLocationAccess,
      saveAddress,
      updateAddress,
      deleteAddress,
      selectAddress,
      getCurrentLocation,
      saveCurrentLocationAsAddress
    }}>
      {children}
    </AddressContext.Provider>
  );
};