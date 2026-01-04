import React, { useState } from 'react';
import { useAddress } from '../context/AddressContext';
import { showToast } from './Toast';
import { geocodeAddress, checkServiceability } from '../utils/serviceAreaUtils';
import { useFirebaseObject } from '../hooks/useFirebase';

const AddressModal = ({ isOpen, onClose }) => {
  const { 
    savedAddresses, 
    selectedAddress, 
    saveAddress, 
    selectAddress, 
    deleteAddress,
    getCurrentLocation,
    saveCurrentLocationAsAddress,
    isGettingLocation,
    locationError
  } = useAddress();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddress, setNewAddress] = useState({
    name: '',
    phone: '',
    line1: '',
    city: '',
    pincode: '',
    type: 'home'
  });
  const [locationData, setLocationData] = useState(null);
  const [checkingService, setCheckingService] = useState(false);
  const { data: siteSettings } = useFirebaseObject('/siteSettings');

  if (!isOpen) return null;

  const handleUseCurrentLocation = async () => {
    const location = await getCurrentLocation();
    if (location) {
      setLocationData(location);
      setNewAddress({
        ...newAddress,
        line1: location.line1 || '',
        city: location.city || '',
        pincode: location.pincode || '',
        type: 'current'
      });
      setShowAddForm(true);
    }
  };

  const handleAddAddress = async () => {
    const errors = [];
    if (!newAddress.name.trim()) errors.push('Name is required');
    if (!/^[0-9]{6,15}$/.test(newAddress.phone.replace(/\D/g, ''))) errors.push('Valid phone number required');
    if (!newAddress.line1.trim()) errors.push('Address is required');
    if (!newAddress.city.trim()) errors.push('City is required');
    if (newAddress.pincode && !/^[0-9]{5,6}$/.test(newAddress.pincode)) errors.push('Valid pincode required');

    if (errors.length > 0) {
      showToast(errors[0], 'error');
      return;
    }

    setCheckingService(true);

    try {
      let coordinates = locationData?.coordinates;
      let fullAddress = locationData?.fullAddress;
      
      // If no coordinates from location detection, geocode the manual address
      if (!coordinates) {
        try {
          const geocoded = await geocodeAddress({
            line1: newAddress.line1,
            city: newAddress.city,
            pincode: newAddress.pincode
          });
          coordinates = { lat: geocoded.lat, lng: geocoded.lng };
          fullAddress = geocoded.fullAddress;
        } catch (geocodeError) {
          showToast(geocodeError.message, 'error');
          setCheckingService(false);
          return;
        }
      }

      // Check if the address is in serviceable area
      const serviceCheck = await checkServiceability(coordinates, siteSettings);
      
      if (!serviceCheck.isServiceable) {
        const message = serviceCheck.reason === 'outside_radius' 
          ? `This address is outside our delivery area (${serviceCheck.distance}km away, max ${serviceCheck.maxRadius}km)`
          : 'This address is not in our serviceable area';
        showToast(message, 'error');
        setCheckingService(false);
        return;
      }

      const addressToSave = {
        ...newAddress,
        coordinates,
        fullAddress,
        serviceCheck: {
          isServiceable: serviceCheck.isServiceable,
          distance: serviceCheck.distance,
          checkedAt: new Date().toISOString()
        }
      };

      saveAddress(addressToSave);
      setNewAddress({ name: '', phone: '', line1: '', city: '', pincode: '', type: 'home' });
      setLocationData(null);
      setShowAddForm(false);
      showToast(`Address saved successfully! (${serviceCheck.distance}km from store)`, 'success');
    } catch (error) {
      console.error('Error adding address:', error);
      showToast('Failed to add address. Please try again.', 'error');
    } finally {
      setCheckingService(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Select Delivery Address</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Saved Addresses */}
          {savedAddresses.length > 0 && (
            <div className="space-y-3">
              {savedAddresses.map((address) => (
                <div
                  key={address.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    selectedAddress?.id === address.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    selectAddress(address);
                    onClose();
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-5 h-5 mt-0.5">
                        {address.type === 'home' ? (
                          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm8 8v2a1 1 0 01-1 1H6a1 1 0 01-1-1v-2h8z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 text-sm">{address.name}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase">
                            {address.type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{address.line1}</p>
                        <p className="text-sm text-gray-600">{address.city} - {address.pincode}</p>
                        <p className="text-xs text-gray-500 mt-1">📞 {address.phone}</p>
                        {address.serviceCheck && (
                          <p className="text-xs text-green-600 mt-1">
                            ✅ Serviceable ({address.serviceCheck.distance}km from store)
                          </p>
                        )}
                      </div>
                    </div>
                    {selectedAddress?.id === address.id && (
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add New Address */}
          {!showAddForm ? (
            <div className="space-y-3">
              {/* Use Current Location Button */}
              <button
                onClick={handleUseCurrentLocation}
                disabled={isGettingLocation}
                className="w-full border border-green-500 bg-green-50 text-green-700 rounded-lg p-4 text-center hover:bg-green-100 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-center gap-2">
                  {isGettingLocation ? (
                    <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className="text-sm font-medium">
                    {isGettingLocation ? 'Getting your location...' : 'Use Current Location'}
                  </span>
                </div>
                {locationError && (
                  <div className="text-xs text-red-600 mt-1">{locationError}</div>
                )}
              </button>

              {/* Manual Add Address Button */}
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-green-500 hover:bg-green-50 transition-colors group"
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-sm font-medium text-gray-600 group-hover:text-green-600">Add Address Manually</span>
                </div>
              </button>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900 text-sm">Add New Address</h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={newAddress.name}
                    onChange={(e) => setNewAddress({...newAddress, name: e.target.value})}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-500"
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={newAddress.phone}
                    onChange={(e) => setNewAddress({...newAddress, phone: e.target.value.replace(/\D/g, '').slice(0,15)})}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
                <textarea
                  placeholder="House No, Building, Area"
                  value={newAddress.line1}
                  onChange={(e) => setNewAddress({...newAddress, line1: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-500"
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="City"
                    value={newAddress.city}
                    onChange={(e) => setNewAddress({...newAddress, city: e.target.value})}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-500"
                  />
                  <input
                    type="text"
                    placeholder="Pincode"
                    value={newAddress.pincode}
                    onChange={(e) => setNewAddress({...newAddress, pincode: e.target.value.replace(/\D/g, '').slice(0,6)})}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="type"
                      value="home"
                      checked={newAddress.type === 'home'}
                      onChange={(e) => setNewAddress({...newAddress, type: e.target.value})}
                      className="text-green-500"
                    />
                    <span className="text-sm text-gray-700">Home</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="type"
                      value="office"
                      checked={newAddress.type === 'office'}
                      onChange={(e) => setNewAddress({...newAddress, type: e.target.value})}
                      className="text-green-500"
                    />
                    <span className="text-sm text-gray-700">Office</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="type"
                      value="other"
                      checked={newAddress.type === 'other'}
                      onChange={(e) => setNewAddress({...newAddress, type: e.target.value})}
                      className="text-green-500"
                    />
                    <span className="text-sm text-gray-700">Other</span>
                  </label>
                </div>
                <button
                  onClick={handleAddAddress}
                  disabled={checkingService}
                  className="w-full bg-green-500 text-white py-2.5 rounded-lg hover:bg-green-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {checkingService ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Checking service area...</span>
                    </div>
                  ) : (
                    'Save Address'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddressModal;