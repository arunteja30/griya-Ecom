// Helper function to calculate distance between two coordinates using Haversine formula
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
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

// Check if coordinates are within serviceable area
export const checkServiceability = async (coordinates, siteSettings) => {
  if (!coordinates || !coordinates.lat || !coordinates.lng) {
    return {
      isServiceable: false,
      reason: 'invalid_coordinates',
      distance: null,
      maxRadius: null
    };
  }

  if (!siteSettings) {
    return {
      isServiceable: false,
      reason: 'settings_unavailable',
      distance: null,
      maxRadius: null
    };
  }

  // Get store location and delivery radius from settings
  const storeLat = siteSettings.storeLocation?.lat || siteSettings.storeLocation?.latitude;
  const storeLon = siteSettings.storeLocation?.lon || siteSettings.storeLocation?.longitude;
  const maxRadius = Number(siteSettings.deliveryRadiusKm) || 50; // Default 50km

  if (!storeLat || !storeLon) {
    // If no store location configured, assume serviceable
    return {
      isServiceable: true,
      reason: 'no_store_location_configured',
      distance: null,
      maxRadius: null
    };
  }

  // Calculate distance between user location and store
  const distance = calculateDistance(coordinates.lat, coordinates.lng, storeLat, storeLon);
  const isServiceable = distance <= maxRadius;

  return {
    isServiceable,
    reason: isServiceable ? 'within_radius' : 'outside_radius',
    distance: Math.round(distance * 10) / 10, // Round to 1 decimal
    maxRadius
  };
};

// Geocode address to get coordinates (using free Nominatim service)
export const geocodeAddress = async (addressComponents) => {
  try {
    const { line1, city, pincode, state = '', country = 'India' } = addressComponents;
    
    // Build query string for geocoding
    const addressQuery = [line1, city, state, pincode, country]
      .filter(Boolean)
      .join(', ');

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery)}&countrycodes=in&limit=1`
    );
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        fullAddress: result.display_name
      };
    }
    
    throw new Error('Address not found');
  } catch (error) {
    console.error('Geocoding error:', error);
    throw new Error('Unable to locate address. Please check the address details.');
  }
};