import React, { useState } from 'react';
import { useAddress } from '../context/AddressContext';
import BottomSheet from './BottomSheet';
import AddressBottomSheet from './AddressBottomSheet';

const AddressGuard = ({ children }) => {
  const { selectedAddress, getCurrentLocation, saveCurrentLocationAsAddress, isGettingLocation, locationError } = useAddress();
  const [showModal, setShowModal] = useState(false);

  const handleUseCurrentLocation = async () => {
    const location = await getCurrentLocation();
    if (location) {
      // Auto-save current location with default data
      const addressData = {
        ...location,
        name: 'Current Location',
        phone: '', // Will need to be filled later
        type: 'current'
      };
      await saveCurrentLocationAsAddress(addressData);
    }
  };

  // If address is selected, render children
  if (selectedAddress) {
    return children;
  }

  // Otherwise, show address selection screen
  return (
    <>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 fixed inset-0 z-60">
        <div className="w-full max-w-md text-center space-y-6">
          {/* Location Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
          </div>

          {/* Content */}
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-gray-900">Select Delivery Location</h2>
            <p className="text-gray-600 text-sm">
              We need your location to show nearby stores and provide accurate delivery estimates
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Use Current Location */}
            <button
              onClick={handleUseCurrentLocation}
              disabled={isGettingLocation}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-4 px-6 rounded-lg transition-colors disabled:cursor-not-allowed font-medium"
            >
              {isGettingLocation ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Getting your location...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <span>Use Current Location</span>
                </div>
              )}
            </button>

            {/* Error Message */}
            {locationError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm text-red-700 font-medium">Location Error</p>
                    <p className="text-sm text-red-600 mt-1">{locationError}</p>
                    {locationError.includes('denied') && (
                      <div className="mt-2 text-xs text-red-600 space-y-1">
                        <p><strong>To enable location:</strong></p>
                        <ul className="list-disc ml-4 space-y-1">
                          <li>Click the location icon (🔒) in your browser's address bar</li>
                          <li>Select "Allow" for location permissions</li>
                          <li>Refresh the page and try again</li>
                        </ul>
                      </div>
                    )}
                    {locationError.includes('timeout') && (
                      <div className="mt-2 text-xs text-red-600">
                        <p><strong>Tips:</strong> Try moving to an area with better GPS signal or use manual address entry.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Manual Address Selection */}
            <button
              onClick={() => setShowModal(true)}
              className="w-full border border-gray-300 text-gray-700 py-4 px-6 rounded-lg transition-colors hover:bg-gray-50 font-medium"
            >
              Enter Address Manually
            </button>
          </div>

          {/* Info */}
          <div className="text-xs text-gray-500 space-y-2">
            <div>
              <p className="font-medium text-gray-600">📍 Your location helps us:</p>
              <ul className="text-left space-y-1 max-w-xs mx-auto mt-1">
                <li>• Show nearby stores and restaurants</li>
                <li>• Provide accurate delivery time</li>
                <li>• Calculate delivery fees</li>
              </ul>
            </div>
            <div className="border-t border-gray-200 pt-2">
              <p className="font-medium text-gray-600">🔒 Privacy:</p>
              <p className="text-left max-w-xs mx-auto mt-1">
                Your location is only used for delivery and never shared with third parties.
              </p>
            </div>
          </div>
        </div>
      </div>

      <BottomSheet 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Set Delivery Address"
      >
        <AddressBottomSheet 
          onClose={() => setShowModal(false)}
        />
      </BottomSheet>
    </>
  );
};

export default AddressGuard;