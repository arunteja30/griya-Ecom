import React from 'react';
import { useAddress } from '../context/AddressContext';
import AddressTestPage from '../pages/AddressTestPage';

const SimpleAddressGuard = ({ children }) => {
  const { selectedAddress } = useAddress();

  // For testing, let's show test page if no address
  if (!selectedAddress) {
    return <AddressTestPage />;
  }

  return children;
};

export default SimpleAddressGuard;