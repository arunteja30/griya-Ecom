// Lightweight client-side location helpers
// - getCurrentPosition: wraps browser geolocation
// - reverseGeocode: uses Nominatim (OpenStreetMap) to get address (city, postcode)
// - getWeather: uses Open-Meteo to get current temperature and conditions

export function getCurrentPosition(options = { enableHighAccuracy: false, timeout: 10000 }) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      options
    );
  });
}

export async function reverseGeocode(lat, lon) {
  // Use Nominatim reverse geocoding. Throttle requests; this is intended for light usage.
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&addressdetails=1`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'griya-ecom/1.0 (contact@example.com)' } });
  if (!resp.ok) throw new Error('Reverse geocode failed');
  const data = await resp.json();
  // return address object with common fields
  return {
    displayName: data.display_name,
    city: data.address.city || data.address.town || data.address.village || data.address.county || '',
    state: data.address.state || '',
    country: data.address.country || '',
    postcode: data.address.postcode || '',
  };
}

export async function getWeather(lat, lon) {
  // Use Open-Meteo free API for current weather
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current_weather=true&temperature_unit=celsius`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Weather fetch failed');
  const data = await resp.json();
  return data.current_weather || null;
}

export default {
  getCurrentPosition,
  reverseGeocode,
  getWeather,
};
