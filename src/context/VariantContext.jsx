import React, { createContext, useContext, useState } from 'react';

const VariantContext = createContext();

export const useVariant = () => {
  const context = useContext(VariantContext);
  if (!context) {
    throw new Error('useVariant must be used within a VariantProvider');
  }
  return context;
};

export const VariantProvider = ({ children }) => {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  const openVariantSelector = (product) => {
    setSelectedProduct(product);
    setIsBottomSheetOpen(true);
  };

  const closeVariantSelector = () => {
    setIsBottomSheetOpen(false);
    setSelectedProduct(null);
  };

  return (
    <VariantContext.Provider
      value={{
        selectedProduct,
        isBottomSheetOpen,
        openVariantSelector,
        closeVariantSelector,
      }}
    >
      {children}
    </VariantContext.Provider>
  );
};