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
      className="product-card card group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Product Image Container */}
      <div className="relative overflow-hidden bg-neutral-50 aspect-square">
        <img 
          src={normalizeImageUrl(product.images?.[0] || '/placeholder.jpg')} 
          alt={product.name} 
          className="product-image"
        />
        
        {/* Image Overlay on Hover */}
        <div className={`absolute inset-0 bg-black/20 transition-opacity duration-300 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className="absolute inset-0 flex items-center justify-center">
            <Link 
              to={`/product/${product.slug}`}
              className="btn btn-secondary opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14v7m0 0l-3-3m3 3l3-3" />
              </svg>
              View Details
            </Link>
          </div>
        </div>

        {/* Badge for new products or offers */}
        {product.isNew && (
          <div className="absolute top-3 left-3 bg-accent-600 text-white text-xs font-bold px-2 py-1 rounded-full">
            New
          </div>
        )}
        
        {product.discount && (
          <div className="absolute top-3 right-3 bg-error text-white text-xs font-bold px-2 py-1 rounded-full">
            -{product.discount}%
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="p-4 space-y-3">
        {/* Category */}
        {product.category && (
          <div className="text-xs text-accent-600 font-semibold uppercase tracking-wide">
            {product.category}
          </div>
        )}

        {/* Product Name */}
        <Link to={`/product/${product.slug}`} className="block">
          <h3 className="font-semibold text-primary-900 text-sm line-clamp-2 hover:text-accent-600 transition-colors duration-200">
            {product.name}
          </h3>
        </Link>

        {/* Rating */}
        {product.rating && (
          <div className="flex items-center gap-1">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className={`w-3 h-3 ${
                    i < Math.floor(product.rating) ? 'text-yellow-400' : 'text-neutral-300'
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-xs text-neutral-500 ml-1">
              ({product.reviewCount || 0})
            </span>
          </div>
        )}

        {/* Price - reduced size */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-primary-900">
            {formatPrice(product.price)}
          </span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="text-xs text-neutral-500 line-through">
              {formatPrice(product.originalPrice)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleAddToCart}
            disabled={isLoading || !product.inStock}
            className={`btn btn-primary flex-1 flex items-center justify-center gap-2 px-3 py-2 ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            } ${!product.inStock ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5 6m0 0h9M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6" />
            </svg>
            
          </button>
          
      
        </div>
      </div>

     {/* Quick add cart icon overlay */}
<button onClick={handleAddToCart} className="absolute right-3 bottom-16 md:bottom-20 bg-white p-2 rounded-full shadow hover:shadow-md transition-colors" title="Quick add">
 
</button>
    </div>
  );
}
