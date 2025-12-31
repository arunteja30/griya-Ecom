import React, { useState } from 'react';
import { useVariant } from '../context/VariantContext';
import { useCart } from '../context/CartContext';
import BottomSheet from './BottomSheet';

export default function VariantSelector() {
  const { selectedProduct, isBottomSheetOpen, closeVariantSelector } = useVariant();
  const { addToCart } = useCart();
  const [isLoading, setIsLoading] = useState(false);

  if (!selectedProduct) return null;

  // normalize variants to an array so frontend works with both shapes
  const variants = Array.isArray(selectedProduct.variants)
    ? selectedProduct.variants
    : (selectedProduct.variants ? Object.values(selectedProduct.variants) : []);

  const handleVariantSelect = async (variant) => {
    setIsLoading(true);
    try {
      const baseId = selectedProduct.id || selectedProduct.slug || selectedProduct.name;
      const itemForCart = {
        ...selectedProduct,
        id: `${baseId}-${variant.id}`,
        variantId: variant.id,
        variantLabel: variant.label,
        price: Number(variant.price),
        originalPrice: variant.originalPrice || selectedProduct.originalPrice,
        unit: variant.label + (variant.unit || '')
      };
      await addToCart(itemForCart, 1);
      closeVariantSelector();
    } catch (error) {
      console.error('Failed to add variant to cart:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BottomSheet 
      isOpen={isBottomSheetOpen} 
      onClose={closeVariantSelector} 
      title="Choose Size/Variant" 
      footer={null}
    >
      <div className="p-6">
        <div className="mb-4">
          <h3 className="font-semibold text-lg">{selectedProduct.name}</h3>
          <p className="text-sm text-surface-600">Select your preferred size</p>
        </div>
        <div className="space-y-3">
          {variants && variants.length ? variants.map((variant) => (
            <div key={variant.id} className="flex items-center justify-between p-4 border border-surface-200 rounded-xl hover:border-primary-300 transition-colors">
              <div>
                <h4 className="font-medium text-surface-900">{variant.label} {variant.unit}</h4>
                <p className="text-sm text-surface-600">₹{variant.price}</p>
                {variant.originalPrice && variant.originalPrice > variant.price && (
                  <p className="text-xs text-surface-400 line-through">₹{variant.originalPrice}</p>
                )}
              </div>
              <button
                onClick={() => handleVariantSelect(variant)}
                className="btn-primary px-6 py-2"
                disabled={isLoading}
              >
                {isLoading ? 'Adding...' : 'Select'}
              </button>
            </div>
          )) : (
            <div className="text-sm text-surface-600 text-center py-8">No variants available</div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}