import React, { useContext, useState } from "react";
import { Link } from "react-router-dom";
import { CartContext } from "../context/CartContext";
import { showToast } from "./Toast";
import { normalizeImageUrl } from '../utils/imageHelpers';
import BottomSheet from './BottomSheet';

export default function ProductCard({ product }) {
  const { addToCart } = useContext(CartContext);
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBottomOpen, setIsBottomOpen] = useState(false);

  const handleAddToCart = async () => {
    setIsLoading(true);
    try {
      await addToCart(product, 1);
      showToast('Added to cart successfully!', 'success');
      setIsBottomOpen(true);
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
    <div 
      className="relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group border border-gray-100"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Product Image Container - Swiggy style */}
      <div className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-gray-100 aspect-square">
        <img 
          src={normalizeImageUrl(product.images?.[0] || '/placeholder.jpg')} 
          alt={product.name} 
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        
        {/* Gradient overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
        
        {/* Stock status badge */}
        {!product.inStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
              Out of Stock
            </span>
          </div>
        )}

        {/* Discount badge - Swiggy style */}
        {product.discount && (
          <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded shadow-sm">
            {product.discount}% OFF
          </div>
        )}
        
        {/* Bestseller badge */}
        {product.isBestseller && (
          <div className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded shadow-sm">
            ⭐ BESTSELLER
          </div>
        )}

        {/* Quick add button - Swiggy style */}
        <button
          onClick={handleAddToCart}
          disabled={isLoading || !product.inStock}
          className={`absolute bottom-2 right-2 bg-white text-orange-500 border-2 border-orange-500 rounded-lg px-3 py-1 text-sm font-bold transition-all duration-200 hover:bg-orange-500 hover:text-white shadow-md ${
            isLoading || !product.inStock ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
          }`}
        >
          {isLoading ? '...' : 'ADD'}
        </button>
      </div>

      {/* Product Details - Swiggy style */}
      <div className="p-3 space-y-2">
        {/* Product Name */}
        <Link to={`/product/${product.slug}`} className="block">
          <h3 className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2 hover:text-orange-600 transition-colors duration-200">
            {product.name}
          </h3>
        </Link>

        {/* Rating and time - Swiggy style */}
        <div className="flex items-center justify-between text-xs text-gray-600">
          {product.rating && (
            <div className="flex items-center gap-1 bg-green-600 text-white px-1 py-0.5 rounded text-xs">
              <span className="text-white">★</span>
              <span>{product.rating}</span>
            </div>
          )}
          {product.deliveryTime && (
            <span className="text-gray-500">{product.deliveryTime} mins</span>
          )}
        </div>

        {/* Price - Swiggy style */}
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-gray-800">
            ₹{product.price}
          </span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="text-sm text-gray-400 line-through">
              ₹{product.originalPrice}
            </span>
          )}
        </div>

        {/* Description/category */}
        {(product.description || product.category) && (
          <p className="text-xs text-gray-500 line-clamp-1">
            {product.description || product.category}
          </p>
        )}
      </div>
    </div>
  );
}
