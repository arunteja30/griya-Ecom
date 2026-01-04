/**
 * Location Service for Driver Real-time Location Updates
 * Handles GPS tracking, location updates to Firebase, and location permissions
 */

import { ref, update } from 'firebase/database';
import { db } from '../firebase';

class LocationService {
  constructor() {
    this.watchId = null;
    this.lastLocationUpdate = null;
    this.isTracking = false;
    this.updateInterval = 10000; // Update every 10 seconds
    this.locationOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000
    };
  }

  /**
   * Start tracking driver location
   * @param {string} driverFirebaseKey - Firebase key of the driver
   * @param {Function} onLocationUpdate - Callback for location updates
   * @param {Function} onError - Callback for errors
   */
  async startTracking(driverFirebaseKey, onLocationUpdate, onError) {
    if (!driverFirebaseKey) {
      onError?.(new Error('Driver Firebase key is required'));
      return false;
    }

    if (!navigator.geolocation) {
      onError?.(new Error('Geolocation is not supported by this browser'));
      return false;
    }

    try {
      // Request permission first
      const permission = await this.requestLocationPermission();
      if (!permission) {
        onError?.(new Error('Location permission denied'));
        return false;
      }

      this.isTracking = true;
      
      // Get initial position
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.updateDriverLocation(driverFirebaseKey, position, onLocationUpdate);
        },
        (error) => {
          console.error('Error getting initial position:', error);
          onError?.(error);
        },
        this.locationOptions
      );

      // Start continuous tracking
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          // Throttle updates to avoid excessive Firebase writes
          const now = Date.now();
          if (!this.lastLocationUpdate || now - this.lastLocationUpdate >= this.updateInterval) {
            this.updateDriverLocation(driverFirebaseKey, position, onLocationUpdate);
            this.lastLocationUpdate = now;
          }
        },
        (error) => {
          console.error('Location tracking error:', error);
          onError?.(error);
        },
        this.locationOptions
      );

      console.log('Location tracking started for driver:', driverFirebaseKey);
      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      onError?.(error);
      return false;
    }
  }

  /**
   * Stop tracking driver location
   */
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    this.lastLocationUpdate = null;
    console.log('Location tracking stopped');
  }

  /**
   * Request location permission
   */
  async requestLocationPermission() {
    if (!navigator.permissions) {
      // Fallback for browsers without permissions API
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          () => resolve(false),
          { timeout: 5000 }
        );
      });
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      return permission.state === 'granted' || permission.state === 'prompt';
    } catch (error) {
      console.error('Error checking location permission:', error);
      return false;
    }
  }

  /**
   * Update driver location in Firebase
   * @param {string} driverFirebaseKey - Firebase key of the driver
   * @param {Position} position - Geolocation position object
   * @param {Function} onLocationUpdate - Callback for successful updates
   */
  async updateDriverLocation(driverFirebaseKey, position, onLocationUpdate) {
    try {
      const timestamp = new Date().toISOString();
      const locationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: timestamp,
        lastUpdated: timestamp
      };

      const updates = {
        [`/drivers/${driverFirebaseKey}/location`]: locationData,
        [`/drivers/${driverFirebaseKey}/isOnline`]: true,
        [`/drivers/${driverFirebaseKey}/lastSeen`]: timestamp
      };

      await update(ref(db), updates);
      
      onLocationUpdate?.(locationData);
      console.log('Driver location updated:', {
        lat: locationData.latitude,
        lng: locationData.longitude,
        accuracy: locationData.accuracy
      });
    } catch (error) {
      console.error('Error updating driver location in Firebase:', error);
      throw error;
    }
  }

  /**
   * Set driver offline status
   * @param {string} driverFirebaseKey - Firebase key of the driver
   */
  async setDriverOffline(driverFirebaseKey) {
    if (!driverFirebaseKey) return;

    try {
      const timestamp = new Date().toISOString();
      const updates = {
        [`/drivers/${driverFirebaseKey}/isOnline`]: false,
        [`/drivers/${driverFirebaseKey}/lastSeen`]: timestamp
      };

      await update(ref(db), updates);
      console.log('Driver set to offline');
    } catch (error) {
      console.error('Error setting driver offline:', error);
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   * @param {number} lat1 - Latitude 1
   * @param {number} lon1 - Longitude 1
   * @param {number} lat2 - Latitude 2
   * @param {number} lon2 - Longitude 2
   * @returns {number} Distance in kilometers
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get current location once
   * @returns {Promise<Object>} Location object with lat, lng
   */
  async getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
          });
        },
        (error) => {
          reject(error);
        },
        this.locationOptions
      );
    });
  }

  /**
   * Check if location tracking is active
   */
  isLocationTrackingActive() {
    return this.isTracking && this.watchId !== null;
  }
}

// Create a singleton instance
const locationService = new LocationService();

export default locationService;