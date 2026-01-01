import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useFirebaseList } from "../hooks/useFirebase";
import { useProductBySlugAll, useAllProducts } from "../hooks/useAllProducts";
import { useCart } from "../context/CartContext";
import ProductCard from "../components/ProductCard";

export default function ProductDetailPage() {
  const { productSlug } = useParams();
  const navigate = useNavigate();
  const { data: product, loading, error } = useProductBySlugAll(productSlug);
  const { data: allProducts } = useAllProducts();
  const { addToCart, cart } = useCart();
  
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);

  // normalize variants to an array so frontend works with both shapes
  const variants = product ? (
    Array.isArray(product.variants)
      ? product.variants
      : (product.variants ? Object.values(product.variants) : [])
  ) : [];

  const [selectedVariant, setSelectedVariant] = useState(null);

  useEffect(() => {
    if (variants && variants.length) {
      // keep previous selection if possible, otherwise pick first
      setSelectedVariant(prev => {
        if (prev) {
          const found = variants.find(v => v.id === prev.id);
          if (found) return found;
        }
        return variants[0];
      });
    } else {
      setSelectedVariant(null);
    }
  }, [product?.variants]);

  const currentCartItem = cart?.find(item => {
    if (!product) return false;
    const baseId = product.id || product.slug || product.name;
    const itemId = selectedVariant ? `${baseId}-${selectedVariant.id}` : product.id;
    return item.id === itemId;
  });
  const cartQuantity = currentCartItem?.quantity || 0;

  // Get current pricing based on selected variant
  const currentPrice = selectedVariant ? Number(selectedVariant.price) : Number(product?.price || 0);
  const currentOriginalPrice = selectedVariant && selectedVariant.originalPrice ? Number(selectedVariant.originalPrice) : product?.originalPrice;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-surface-600">Loading product...</p>
        </div>
      </div>
    );
  }

  // Error or not found state
  if (error || !product) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="text-center space-y-6 px-mobile">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold text-surface-900">Product not found</h2>
          <p className="text-surface-600">The product you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate(-1)}
            className="btn-primary"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Get related products
  const productsArray = allProducts ? Object.entries(allProducts).map(([id, prod]) => ({ id, ...prod })) : [];
  const relatedProducts = productsArray
    .filter(p => p.category === product.category && p.id !== product.id)
    .slice(0, 6);

  const images = product.images || [product.imageUrl].filter(Boolean);
  const hasMultipleImages = images.length > 1;

  // Calculate discount based on current pricing
  const discount = currentOriginalPrice && currentPrice && currentOriginalPrice > currentPrice
    ? Math.round(((currentOriginalPrice - currentPrice) / currentOriginalPrice) * 100)
    : null;

  const handleAddToCart = async () => {
    try {
      // construct a variant-aware product object for the cart
      const baseId = product.id || product.slug || product.name;
      const itemForCart = {
        ...product,
        id: selectedVariant ? `${baseId}-${selectedVariant.id}` : product.id,
        variantId: selectedVariant?.id,
        variantLabel: selectedVariant?.label,
        price: currentPrice,
        originalPrice: currentOriginalPrice,
        unit: selectedVariant?.label || product.unit
      };
      await addToCart(itemForCart, quantity);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    }
  };

  const handleUpdateQuantity = async (newQuantity) => {
    if (newQuantity === 0) {
      // Remove from cart
    } else {
      // Update quantity
    }
  };

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Back Button Header */}
      <div className="bg-white/95 backdrop-blur-md sticky top-16 z-40 border-b border-surface-200/50">
        <div className="px-mobile py-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-surface-600 hover:text-primary-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </button>
        </div>
      </div>

      <div className="px-mobile py-3 space-y-4 pb-safe">
        {/* Product Images Section */}
        <div className="card space-y-3">
          {/* Main Image */}
          <div className="aspect-square bg-surface-100 rounded-xl overflow-hidden relative">
            <img
              src={images[selectedImageIndex] || '/placeholder.jpg'}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = '/placeholder.jpg';
              }}
            />
            
            {/* Floating Badges */}
            {discount && (
              <div className="absolute top-2 left-2 bg-accent-coral text-white px-2 py-1 rounded-lg text-xs font-bold">
                {discount}% OFF
              </div>
            )}
            
            {product.featured && (
              <div className="absolute top-2 right-10 bg-fresh-500 text-white px-2 py-1 rounded-lg text-xs font-bold">
                ⭐ Featured
              </div>
            )}

            {/* Wishlist Button */}
            <button
              onClick={() => setIsWishlisted(!isWishlisted)}
              className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
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

          {/* Image Thumbnails */}
          {hasMultipleImages && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                    selectedImageIndex === index 
                      ? 'border-primary-500 shadow-soft' 
                      : 'border-surface-200 hover:border-surface-300'
                  }`}
                >
                  <img
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info Section */}
        <div className="card space-y-4 p-3">
          {/* Basic Info */}
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-surface-900 leading-tight">{product.name}</h1>
            
            {/* Brand & Category */}
            <div className="flex gap-1 flex-wrap">
              {product.brand && (
                <span className="badge-primary px-2 py-1 text-xs">
                  {product.brand}
                </span>
              )}
              {product.category && (
                <span className="badge bg-surface-100 text-surface-700 px-2 py-1 text-xs">
                  {product.category}
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-surface-700 leading-relaxed text-xs">{product.description}</p>
            )}
          </div>

          {/* Rating & Reviews */}
          {product.rating && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-fresh-500 text-white px-2 py-1.5 rounded-lg">
                <span className="font-bold text-sm">{product.rating}</span>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              {product.reviewCount && (
                <span className="text-surface-600 text-sm">({product.reviewCount} reviews)</span>
              )}
            </div>
          )}

          {/* Variant Selection */}
          {variants && variants.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-surface-900 text-sm">Choose Size/Variant</h3>
              <div className="grid grid-cols-2 gap-2">
                {variants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => setSelectedVariant(variant)}
                    className={`p-2 rounded-lg border transition-all duration-200 text-left ${
                      selectedVariant?.id === variant.id
                        ? 'border-primary-500 bg-primary-50 shadow-sm'
                        : 'border-surface-200 hover:border-primary-300 hover:bg-surface-50'
                    }`}
                  >
                    <div className="font-medium text-surface-900 text-xs mb-1">{variant.label} {variant.unit}</div>
                    <div className="text-xs text-surface-600">₹{variant.price}</div>
                    {variant.originalPrice && variant.originalPrice > variant.price && (
                      <div className="text-xs text-surface-400 line-through">₹{variant.originalPrice}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Price Section */}
          <div className="bg-surface-50 rounded-xl p-3 space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-surface-900">₹{currentPrice}</span>
              {currentOriginalPrice && currentOriginalPrice > currentPrice && (
                <>
                  <span className="text-sm text-surface-400 line-through">₹{currentOriginalPrice}</span>
                  <span className="badge-fresh px-2 py-0.5 text-xs">Save ₹{currentOriginalPrice - currentPrice}</span>
                </>
              )}
            </div>
            
            {/* Stock Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${product.inStock !== false ? 'bg-fresh-500' : 'bg-red-500'}`}></div>
                <span className={`text-sm font-medium ${product.inStock !== false ? 'text-fresh-600' : 'text-red-600'}`}>
                  {product.inStock !== false ? 'In Stock' : 'Out of Stock'}
                </span>
              </div>
              {product.deliveryTime && (
                <div className="flex items-center gap-1 text-surface-600">
                  <span className="text-lg">🚚</span>
                  <span className="text-xs">{product.deliveryTime}</span>
                </div>
              )}
            </div>
          </div>

          {/* Product Details */}
          {(product.weight || product.unit || product.brand) && (
            <div className="space-y-3">
              <h3 className="font-semibold text-surface-900">Product Details</h3>
              <div className="space-y-2">
                {product.weight && (
                  <div className="flex justify-between items-center py-2 border-b border-surface-100 last:border-b-0">
                    <span className="text-surface-600 text-sm">Weight:</span>
                    <span className="font-medium text-surface-900 text-sm">{product.weight}</span>
                  </div>
                )}
                {product.unit && (
                  <div className="flex justify-between items-center py-2 border-b border-surface-100 last:border-b-0">
                    <span className="text-surface-600 text-sm">Unit:</span>
                    <span className="font-medium text-surface-900 text-sm">{product.unit}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Add to Cart Section */}
        {product.inStock !== false && (
          <div className="card p-3 space-y-3">
            {cartQuantity === 0 ? (
              <>
                {/* Quantity Selector */}
                <div className="flex items-center justify-between">
                  <span className="font-medium text-surface-900 text-sm">Quantity:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-8 h-8 rounded-lg border border-surface-300 flex items-center justify-center hover:bg-surface-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="w-8 text-center font-semibold text-sm">{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-8 h-8 rounded-lg border border-surface-300 flex items-center justify-center hover:bg-surface-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Add to Cart Button */}
                <button
                  onClick={handleAddToCart}
                  className="btn-primary w-full py-3 text-base font-bold rounded-xl"
                >
                  Add to Cart • ₹{currentPrice * quantity}
                </button>
              </>
            ) : (
              /* Already in Cart */
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-fresh-50 border border-fresh-200 rounded-2xl">
                  <span className="text-fresh-700 font-medium">✓ Added to cart</span>
                  <span className="text-fresh-600 font-bold">{cartQuantity} item(s)</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleUpdateQuantity(cartQuantity - 1)}
                    className="btn-ghost"
                  >
                    {cartQuantity === 1 ? 'Remove' : 'Decrease'}
                  </button>
                  <button
                    onClick={handleAddToCart}
                    className="btn-fresh"
                  >
                    Add More
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-surface-900">Related Products</h2>
            <div className="story-scroll">
              {relatedProducts.map((relatedProduct) => (
                <div key={relatedProduct.id} className="w-40 flex-shrink-0">
                  <ProductCard product={relatedProduct} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}