import React, { useState } from 'react';
import { useAddress } from '../context/AddressContext';
import AddressModal from './AddressModal';

const AddressSelector = () => {
  const { selectedAddress } = useAddress();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div 
        className="bg-white border-b border-gray-100 p-3 px-mobile cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setShowModal(true)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            {selectedAddress ? (
              <>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-gray-900">Deliver to</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded uppercase">
                    {selectedAddress.type}
                  </span>
                </div>
                <div className="text-sm text-gray-600 truncate">
                  {selectedAddress.line1}, {selectedAddress.city} - {selectedAddress.pincode}
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-medium text-gray-900 mb-0.5">Set Delivery Address</div>
                <div className="text-xs text-gray-500">Choose your location for better delivery</div>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      <AddressModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
};

export default AddressSelector;