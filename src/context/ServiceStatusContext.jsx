import React, { createContext, useContext, useState } from 'react';

const ServiceStatusContext = createContext();

export const ServiceStatusProvider = ({ children }) => {
  const [isServiceable, setIsServiceable] = useState(true);

  return (
    <ServiceStatusContext.Provider value={{ isServiceable, setIsServiceable }}>
      {children}
    </ServiceStatusContext.Provider>
  );
};

export const useServiceStatus = () => {
  const context = useContext(ServiceStatusContext);
  return context || { isServiceable: true, setIsServiceable: () => {} }; // Default to serviceable if no context
};