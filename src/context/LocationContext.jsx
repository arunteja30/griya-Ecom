import React, { createContext, useContext } from 'react';
import { useLocation as useLocationHook } from '../hooks/useLocation';

const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const location = useLocationHook();

  return (
    <LocationContext.Provider value={location}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};