import React, { useContext, useState } from "react";
import { Link } from "react-router-dom";
import { CartContext } from "../context/CartContext";
import { showToast } from "./Toast";
import { normalizeImageUrl } from '../utils/imageHelpers';

export default function ProductCard({ product }) {
  const { addToCart } = useContext(CartContext);
  const [isLoading, setIsLoading] = useState(false);

  const handleAddToCart = async () => {
    setIsLoading(true);
    try {
      await addToCart(product, 1);
      showToast('Added to cart', 'success');
    } catch (error) {
      showToast('Failed to add to cart', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-neutral-100 hover:shadow-lg transition-all duration-200 group">
      {/* Product Image - Swiggy style square aspect */}
      <Link to={`/product/${product.slug}`} className="block relative overflow-hidden bg-neutral-50 aspect-square">
        <img 
          src={normalizeImageUrl(product.images?.[0] || '/placeholder.jpg')} 
          alt={product.name} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        
        {/* Badges */}
        {product.discount && (
          <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded">
            {product.discount}% OFF
          </div>
        )}
        {!product.inStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-semibold">Out of Stock</span>
          </div>
        )}
      </Link>

      {/* Product Details - compact Swiggy style */}
      <div className="p-3 space-y-2">
        {/* Product Name */}
        <Link to={`/product/${product.slug}`} className="block">
          <h3 className="font-semibold text-sm text-neutral-900 line-clamp-2 group-hover:text-primary-600 transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Unit/Weight */}
        {product.unit && (
          <div className="text-xs text-neutral-500">{product.unit}</div>
        )}

        {/* Price and Add Button - Swiggy inline style */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex flex-col">
            <span className="text-base font-bold text-neutral-900">
              {formatPrice(product.price)}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-xs text-neutral-400 line-through">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>

          <button
            onClick={handleAddToCart}
            disabled={isLoading || !product.inStock}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              product.inStock 
                ? 'bg-white text-green-600 border-2 border-green-600 hover:bg-green-600 hover:text-white' 
                : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? '...' : 'ADD'}
          </button>
        </div>
      </div>
    </div>
  );
}

