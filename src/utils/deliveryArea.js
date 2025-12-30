export function normalizePincode(pincode) {
  if (!pincode) return '';
  return String(pincode).replace(/\D/g, '').trim();
}

export function isPincodeServiceable(pincode, siteSettings) {
  const p = normalizePincode(pincode);
  if (!p) return false;

  const allowed = siteSettings?.serviceablePincodes;
  if (!allowed) return true;

  if (Array.isArray(allowed)) {
    const normalized = allowed.map((x) => normalizePincode(x));
    return normalized.includes(p);
  }

  if (typeof allowed === 'string') {
    const parts = allowed.split(/[\s,;|]+/).map((x) => normalizePincode(x)).filter(Boolean);
    return parts.includes(p);
  }

  return true;
}

export default { isPincodeServiceable, normalizePincode };

// --- Geofence helpers (lat/lon based) ---
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // Earth radius km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// siteSettings.storeLocation expected to be { lat: number, lon: number } or { latitude, longitude }
export function isLocationServiceable(lat, lon, siteSettings) {
  if (!lat && lat !== 0) return true; // can't determine -> default allow
  if (!lon && lon !== 0) return true;

  const store = siteSettings?.storeLocation || siteSettings?.store || null;
  const radiusKm = Number(siteSettings?.deliveryRadiusKm || siteSettings?.deliveryRadius || 0);
  if (!store || !radiusKm || Number(radiusKm) <= 0) {
    // No geofence configured; allow by default
    return true;
  }

  const storeLat = Number(store.lat ?? store.latitude ?? store.latitud ?? 0);
  const storeLon = Number(store.lon ?? store.longitude ?? store.long ?? store.lng ?? 0);
  if (!storeLat || !storeLon) return true;

  const d = haversineDistanceKm(Number(lat), Number(lon), storeLat, storeLon);
  return d <= Number(radiusKm);
}

export { isPincodeServiceable as fallbackPincodeServiceable };
