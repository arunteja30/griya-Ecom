import React, { useState } from 'react';
import { useAddress } from '../context/AddressContext';
import { showToast } from './Toast';
import { geocodeAddress, checkServiceability } from '../utils/serviceAreaUtils';
import { useFirebaseObject } from '../hooks/useFirebase';

const AddressBottomSheet = ({ onClose }) => {
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

  const handleUseCurrentLocation = async () => {
    try {
      const location = await getCurrentLocation();
      if (location) {
        const addressData = {
          ...location,
          name: 'Current Location',
          phone: '',
          type: 'current'
        };
        await saveCurrentLocationAsAddress(addressData);
        showToast('Location saved successfully!', 'success');
        onClose();
      }
    } catch (error) {
      console.error('Error using current location:', error);
      showToast('Failed to get current location', 'error');
    }
  };

  const handleAddAddress = async () => {
    if (!newAddress.name || !newAddress.phone || !newAddress.line1 || !newAddress.city || !newAddress.pincode) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    setCheckingService(true);
    
    try {
      // Get coordinates for the address
      const fullAddress = `${newAddress.line1}, ${newAddress.city}, ${newAddress.pincode}`;
      const coordinates = await geocodeAddress(fullAddress);
      
      // Check serviceability
      const serviceCheck = await checkServiceability(coordinates, siteSettings);
      
      if (!serviceCheck.isServiceable) {
        const message = serviceCheck.distance 
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
      onClose();
    } catch (error) {
      console.error('Error adding address:', error);
      showToast('Failed to add address. Please try again.', 'error');
    } finally {
      setCheckingService(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* Saved Addresses */}
      {savedAddresses.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Saved Addresses</h3>
          {savedAddresses.map((address) => (
            <div
              key={address.id}
              className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                selectedAddress?.id === address.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => {
                selectAddress(address);
                onClose();
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 text-sm">{address.name}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase">{address.type}</span>
                    </div>
                    <p className="text-sm text-gray-600">{address.line1}</p>
                    <p className="text-sm text-gray-600">{address.city} - {address.pincode}</p>
                  </div>
                  {selectedAddress?.id === address.id && (
                    <div className="w-5 h-5 text-green-500">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

        {/* Location Error Display */}
        {locationError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm text-red-700 font-medium">Location Error</p>
                <p className="text-sm text-red-600 mt-1">{locationError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Add New Address Options */}
        {!showAddForm ? (
          <div className="space-y-3">
            {/* Use Current Location Button */}
            <button
              onClick={handleUseCurrentLocation}
              disabled={isGettingLocation}
              className="w-full border border-green-500 bg-green-50 text-green-700 rounded-lg p-4 text-center hover:bg-green-100 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5">
                  {isGettingLocation ? (
                    <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className="font-medium">
                  {isGettingLocation ? 'Getting current location...' : 'Use Current Location'}
                </span>
              </div>
            </button>

            {/* Add New Address Button */}
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full border border-gray-300 text-gray-700 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-center gap-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="font-medium">Add New Address</span>
              </div>
            </button>
          </div>
        ) : (
          /* Add New Address Form */
          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Add New Address</h3>
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
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={newAddress.phone}
                  onChange={(e) => setNewAddress({...newAddress, phone: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <input
                type="text"
                placeholder="House/Flat No, Area, Landmark"
                value={newAddress.line1}
                onChange={(e) => setNewAddress({...newAddress, line1: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="City"
                  value={newAddress.city}
                  onChange={(e) => setNewAddress({...newAddress, city: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <input
                  type="text"
                  placeholder="Pincode"
                  value={newAddress.pincode}
                  onChange={(e) => setNewAddress({...newAddress, pincode: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              {/* Address Type Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Address Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="type"
                      value="home"
                      checked={newAddress.type === 'home'}
                      onChange={(e) => setNewAddress({...newAddress, type: e.target.value})}
                      className="text-green-500 focus:ring-green-500"
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
                      className="text-green-500 focus:ring-green-500"
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
                      className="text-green-500 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">Other</span>
                  </label>
                </div>
              </div>
              
              <button
                onClick={handleAddAddress}
                disabled={checkingService}
                className="w-full bg-green-500 text-white p-3 rounded-lg font-medium hover:bg-green-600 disabled:bg-gray-300 transition-colors"
              >
                {checkingService ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Checking serviceability...
                  </div>
                ) : (
                  'Save Address'
                )}
              </button>
            </div>
          </div>
        )}
    </div>
  );
};

export default AddressBottomSheet;