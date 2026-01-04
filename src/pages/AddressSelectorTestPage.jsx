import React, { useState } from 'react';
import { AddressProvider, useAddress } from '../context/AddressContext';
import AddressSelector from '../components/AddressSelector';

const TestControls = () => {
  const { saveAddress, savedAddresses } = useAddress();
  const [testResult, setTestResult] = useState('');
  
  const addSampleAddresses = () => {
    if (savedAddresses.length === 0) {
      const sampleAddresses = [
        {
          name: 'John Doe',
          phone: '+91 9876543210',
          line1: '123 MG Road',
          city: 'Bangalore',
          pincode: '560001',
          type: 'home'
        },
        {
          name: 'John Doe',
          phone: '+91 9876543210',  
          line1: 'Tech Park, Phase 2',
          city: 'Bangalore',
          pincode: '560066',
          type: 'office'
        }
      ];
      
      sampleAddresses.forEach(addr => saveAddress(addr));
      setTestResult('Sample addresses added!');
    } else {
      setTestResult('Addresses already exist');
    }
  };
  
  return (
    <div className="p-4 space-y-4">
      <button 
        onClick={addSampleAddresses}
        className="w-full bg-green-500 text-white p-3 rounded-lg hover:bg-green-600"
      >
        Add Sample Addresses ({savedAddresses.length} exist)
      </button>
      
      {testResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-green-800">{testResult}</p>
        </div>
      )}
    </div>
  );
};

const AddressSelectorTestPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="p-4">
          <h1 className="text-xl font-bold mb-4">Address Selector Test</h1>
          <p className="text-gray-600 mb-6">Click the address bar below to test the bottom sheet functionality:</p>
        </div>
        
        <AddressProvider>
          <TestControls />
          <AddressSelector />
          
          <div className="p-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h2 className="font-medium text-blue-900">Test Instructions:</h2>
              <ol className="text-sm text-blue-800 mt-2 space-y-1 list-decimal list-inside">
                <li>First add sample addresses using button above</li>
                <li>Click on the address bar to open bottom sheet</li>
                <li>The bottom sheet should slide up from the bottom</li>
                <li>Test selecting saved addresses</li>
                <li>Test "Use Current Location" button</li>
                <li>Test "Add New Address" button and form</li>
                <li>Test closing the bottom sheet by clicking the X or outside area</li>
              </ol>
            </div>
          </div>
        </AddressProvider>
      </div>
    </div>
  );
};

export default AddressSelectorTestPage;