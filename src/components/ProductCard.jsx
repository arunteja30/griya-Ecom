import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useVariant } from "../context/VariantContext";
import { useWishlist } from "../context/WishlistContext";

export default function ProductCard({ product }) {
  const { addToCart, cart } = useCart();
  const { openVariantSelector } = useVariant();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [isLoading, setIsLoading] = useState(false);

  const isWishlisted = isInWishlist(product.id);

  // normalize variants to an array so frontend works with both shapes
  const variants = Array.isArray(product.variants)
    ? product.variants
    : (product.variants ? Object.values(product.variants) : []);

  const [selectedVariant, setSelectedVariant] = useState(null);

  useEffect(() => {
    if (variants && variants.length) {
      // Always show first variant as default
      setSelectedVariant(variants[0]);
    } else {
      setSelectedVariant(null);
    }
  }, [product.variants]);

  const currentCartItem = cart?.find(item => {
    const baseId = product.id || product.slug || product.name;
    const itemId = selectedVariant ? `${baseId}-${selectedVariant.id}` : baseId;
    return item.id === itemId;
  });
  const cartQuantity = currentCartItem?.quantity || 0;

  const handleAddToCart = async () => {
    setIsLoading(true);
    try {
      // construct a variant-aware product object for the cart
      const baseId = product.id || product.slug || product.name;
      const itemForCart = {
        ...product,
        id: selectedVariant ? `${baseId}-${selectedVariant.id}` : baseId,
        variantId: selectedVariant?.id,
        variantLabel: selectedVariant?.label,
        price: selectedVariant ? Number(selectedVariant.price) : Number(product.price),
        originalPrice: selectedVariant && selectedVariant.price && product.originalPrice ? Number(product.originalPrice) : product.originalPrice,
        unit: selectedVariant?.label || product.unit
      };
      await addToCart(itemForCart, 1);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const currentPrice = selectedVariant ? Number(selectedVariant.price) : Number(product.price);
  const currentOriginalPrice = selectedVariant && selectedVariant.originalPrice ? Number(selectedVariant.originalPrice) : product.originalPrice;
  
  const discount = currentOriginalPrice && currentPrice && currentOriginalPrice > currentPrice 
    ? Math.round(((currentOriginalPrice - currentPrice) / currentOriginalPrice) * 100)
    : null;

  return (
    <div className="card-product group">
      {/* Product Image Container */}
      <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-surface-100">
        <Link to={`/product/${product.slug || product.id}`}>
          <img 
            src={product.imageUrl || product.images?.[0] || '/placeholder.jpg'}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            loading="lazy"
          />
        </Link>

        {/* Floating Badges */}
        {product.featured && (
          <div className="badge-floating badge-fresh bottom-2 left-2">
            ⭐ Featured
          </div>
        )}

        {/* Wishlist Button */}
        <button
          onClick={() => toggleWishlist(product)}
          className={`absolute top-1 right-1 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
            isWishlisted 
              ? 'bg-red-500 text-white shadow-glow' 
              : 'bg-white/80 backdrop-blur-sm text-surface-400 hover:text-red-500'
          }`}
        >
          <svg className="w-4 h-4" fill={isWishlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Product Info */}
      <div className="space-y-1 pt-1">
        {/* Product Name */}
        <div>
          <Link to={`/product/${product.slug || product.id}`}>
            <h3 className="text-[10px] font-semibold text-surface-900 line-clamp-1 group-hover:text-primary-600 transition-colors leading-tight">
              {product.name}
            </h3>
          </Link>
        </div>

        {/* Unit Display */}
        <div className="text-[9px] text-surface-600 bg-surface-100 px-1 py-0.5 rounded inline-block">
          {selectedVariant?.label || product.unit || 'Each'}
        </div>


        {/* Price */}
        <div className="flex items-center gap-1">
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-bold text-surface-900">
              ₹{currentPrice}
            </span>
            {currentOriginalPrice && currentOriginalPrice > currentPrice && (
              <span className="text-[9px] text-surface-400 line-through">
                ₹{currentOriginalPrice}
              </span>
            )}
          </div>
          {discount && (
            <span className="badge-coral text-[8px] px-1 py-0.5 ml-1">
              {discount}% OFF
            </span>
          )}
        </div>

        {/* Add to Cart Button */}
        {cartQuantity === 0 ? (
          <div className="flex gap-1 w-full">
            {variants && variants.length > 0 ? (
              <button
                onClick={() => openVariantSelector(product)}
                className="btn-primary text-[9px] px-1.5 py-0.5 w-full"
              >
                Choose
              </button>
            ) : (
              <button
                onClick={handleAddToCart}
                disabled={isLoading}
                className="btn-primary text-[9px] px-1.5 py-0.5 w-full"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'Add'
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <div className="flex items-center bg-primary-50 rounded">
              <button
                onClick={() => {/* decrease quantity */}}
                className="w-4 h-4 flex items-center justify-center text-primary-600 hover:bg-primary-100 rounded-l transition-colors"
              >
                <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="px-1 py-0.5 text-[9px] font-semibold text-primary-700 min-w-4 text-center">
                {cartQuantity}
              </span>
              <button
                onClick={handleAddToCart}
                className="w-4 h-4 flex items-center justify-center text-primary-600 hover:bg-primary-100 rounded-r transition-colors"
              >
                <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}