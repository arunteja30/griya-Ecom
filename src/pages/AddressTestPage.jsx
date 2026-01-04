import React from 'react';
import { useAddress } from '../context/AddressContext';

const AddressTestPage = () => {
  const { 
    savedAddresses, 
    selectedAddress, 
    getCurrentLocation, 
    saveCurrentLocationAsAddress,
    isGettingLocation,
    locationError 
  } = useAddress();

  const handleTestLocation = async () => {
    const location = await getCurrentLocation();
    console.log('Location result:', location);
    
    if (location) {
      const addressData = {
        ...location,
        name: 'Test Location',
        phone: '9876543210',
        type: 'current'
      };
      await saveCurrentLocationAsAddress(addressData);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Address System Test</h1>
      
      {/* Current Status */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h2 className="font-semibold mb-2">Current Status</h2>
        <p>Selected Address: {selectedAddress ? selectedAddress.name : 'None'}</p>
        <p>Total Addresses: {savedAddresses.length}</p>
        <p>Getting Location: {isGettingLocation ? 'Yes' : 'No'}</p>
        {locationError && <p className="text-red-600">Error: {locationError}</p>}
      </div>

      {/* Selected Address Details */}
      {selectedAddress && (
        <div className="bg-green-50 p-4 rounded-lg mb-6">
          <h2 className="font-semibold mb-2">Selected Address</h2>
          <p><strong>Name:</strong> {selectedAddress.name}</p>
          <p><strong>Phone:</strong> {selectedAddress.phone}</p>
          <p><strong>Line 1:</strong> {selectedAddress.line1}</p>
          <p><strong>City:</strong> {selectedAddress.city}</p>
          <p><strong>Pincode:</strong> {selectedAddress.pincode}</p>
          <p><strong>Type:</strong> {selectedAddress.type}</p>
          {selectedAddress.coordinates && (
            <p><strong>Coordinates:</strong> {selectedAddress.coordinates.lat}, {selectedAddress.coordinates.lng}</p>
          )}
          {selectedAddress.fullAddress && (
            <p><strong>Full Address:</strong> {selectedAddress.fullAddress}</p>
          )}
        </div>
      )}

      {/* All Addresses */}
      {savedAddresses.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h2 className="font-semibold mb-2">All Saved Addresses</h2>
          {savedAddresses.map((addr, index) => (
            <div key={addr.id} className="border-b border-blue-200 pb-2 mb-2 last:border-b-0">
              <p><strong>{index + 1}. {addr.name}</strong> - {addr.city}</p>
            </div>
          ))}
        </div>
      )}

      {/* Test Button */}
      <button
        onClick={handleTestLocation}
        disabled={isGettingLocation}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
      >
        {isGettingLocation ? 'Getting Location...' : 'Test Get Current Location'}
      </button>
    </div>
  );
};

export default AddressTestPage;