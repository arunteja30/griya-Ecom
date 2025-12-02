import React, { useContext, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { CartContext } from "../context/CartContext";
import { showToast } from "./Toast";
import { normalizeImageUrl } from "../utils/imageHelpers";
import { useSiteSettings } from "../hooks/useRealtime";
import UniversalImage from "./UniversalImage";

export default function ProductCard({ product, variant = 'normal' }) {
  const { addToCart } = useContext(CartContext);
  const { data: siteSettings } = useSiteSettings();
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isLarge = variant === 'large' || variant === 'lg';

  // Image source state with fallback to admin-configured default
  const defaultImageFromAdmin = normalizeImageUrl(siteSettings?.defaultProductImage) || '/placeholder.jpg';
  const [imgSrc, setImgSrc] = useState(() => normalizeImageUrl(product.images?.[0]) || defaultImageFromAdmin);
  const triedDefault = useRef(false);

  useEffect(() => {
    // update src when product images or admin default changes
    const src = normalizeImageUrl(product.images?.[0]) || normalizeImageUrl(siteSettings?.defaultProductImage) || '/placeholder.jpg';
    setImgSrc(src);
    triedDefault.current = false;
  }, [product.images, siteSettings]);

  const handleImgError = () => {
    if (triedDefault.current) return; // avoid infinite loop if fallback also fails
    triedDefault.current = true;
    const fallback = normalizeImageUrl(siteSettings?.defaultProductImage) || '/placeholder.jpg';
    setImgSrc(fallback);
  };

  // compute tactical UI data
  const reviews = Array.isArray(product.reviews) ? product.reviews : [];
  // reviewCount for display: prefer actual reviews length, fall back to product.reviewCount
  const reviewCount = reviews.length > 0 ? reviews.length : (Number(product.reviewCount || 0) || 0);
  // avgRating: compute from reviews when available, otherwise use stored avgRating or rating
  const avgRating = reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length) * 10) / 10
    : Number(product.avgRating || product.rating || 0);
  // normalize stock value (some products store stock as string or in `quantity`)
  const rawStockVal = product.stock ?? product.quantity ?? null;
  const hasNumericStock = rawStockVal !== null && rawStockVal !== undefined;
  const stock = hasNumericStock ? Math.max(0, Number(rawStockVal) || 0) : 0;
  // Decide availability: prefer numeric stock when present. If numeric stock is provided and is 0 => out of stock even if product.inStock===true
  let inStock;
  if (hasNumericStock) {
    inStock = stock > 0;
  } else if (typeof product.inStock === 'boolean') {
    inStock = product.inStock;
  } else {
    inStock = true; // default to available when no info
  }
  // show low-stock note only when less than 5 (i.e. 1-4)
  const lowStock = inStock && stock > 0 && stock < 5;
  const isBestseller = Boolean(product.bestseller || product.isBestseller);
  const hasFreeShipping = Boolean(product.freeShipping || product.isFreeShipping);

  const handleAddToCart = async () => {
    setIsLoading(true);
    try {
      addToCart(product, 1);
      showToast("Added to cart successfully!", "success");
    } catch (error) {
      showToast("Failed to add to cart", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price);

  const renderStars = (rating) => {
    const full = Math.floor(rating || 0);
    const half = (rating || 0) - full >= 0.5;
    const stars = [];
    for (let i = 0; i < 5; i++) {
      if (i < full) {
        stars.push(
          <svg key={i} className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" style={{ color: 'var(--accent-color, #F59E0B)' }}>
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.974a1 1 0 00.95.69h4.18c.969 0 1.371 1.24.588 1.81l-3.387 2.46a1 1 0 00-.364 1.118l1.287 3.974c.3.921-.755 1.688-1.54 1.118L10 15.347l-3.387 2.46c-.785.57-1.84-.197-1.54-1.118l1.287-3.974a1 1 0 00-.364-1.118L2.609 9.4c-.783-.57-.38-1.81.588-1.81h4.18a1 1 0 00.95-.69L9.05 2.927z" />
          </svg>
        );
      } else if (i === full && half) {
        stars.push(
          <svg key={i} className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" style={{ color: 'var(--accent-color, #F59E0B)' }}>
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.974a1 1 0 00.95.69h4.18c.969 0 1.371 1.24.588 1.81l-3.387 2.46a1 1 0 00-.364 1.118l1.287 3.974c.3.921-.755 1.688-1.54 1.118L10 15.347V2.927z" />
          </svg>
        );
      } else {
        stars.push(
          <svg key={i} className="w-3 h-3 text-neutral-300" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.974a1 1 0 00.95.69h4.18c.969 0 1.371 1.24.588 1.81l-3.387 2.46a1 1 0 00-.364 1.118l1.287 3.974c.3.921-.755 1.688-1.54 1.118L10 15.347l-3.387 2.46c-.785.57-1.84-.197-1.54-1.118l1.287-3.974a1 1 0 00-.364-1.118L2.609 9.4c-.783-.57-.38-1.81.588-1.81h4.18a1 1 0 00.95-.69L9.05 2.927z" />
          </svg>
        );
      }
    }
    return <div className="flex items-center gap-1">{stars}{reviewCount>0 && <span className="text-[11px] text-neutral-500 ml-1">{reviewCount}</span>}</div>;
  };

  return (
    <div
      className="group bg-white rounded-lg md:rounded-xl overflow-hidden shadow-sm border border-neutral-100 transition-all duration-300 hover:shadow-xl hover:border-accent-200"
      style={{ 
        background: 'linear-gradient(to bottom, #ffffff 0%, #fafafa 100%)',
        borderTop: '1px solid var(--accent-color, rgba(212, 175, 55, 0.15))'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Elegant image area with gold border accent - Reduced for mobile */}
      <div 
        className={`relative overflow-hidden ${isLarge ? 'h-40 sm:h-48 md:h-56 lg:h-64' : 'h-32 sm:h-36 md:h-40 lg:h-48'} flex items-center justify-center`}
        style={{ 
          background: 'linear-gradient(135deg, #fafafa 0%, #ffffff 100%)',
          borderBottom: '1px solid var(--accent-color, rgba(212, 175, 55, 0.1))'
        }}
      >
        <UniversalImage
          src={imgSrc}
          alt={product.name}
          className="w-full h-full object-cover object-center transition-all duration-500 ease-out group-hover:scale-105 group-hover:brightness-105"
          placeholder={normalizeImageUrl(product.images?.[0]) || defaultImageFromAdmin}
          fallback={defaultImageFromAdmin}
        />

        {/* Elegant hover overlay with gold gradient - Hidden on mobile, shown on hover for desktop */}
        <div className={`hidden md:block absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent transition-opacity duration-300 ${isHovered ? "opacity-100" : "opacity-0"}`}>
          <div className="absolute inset-0 flex items-center justify-center">
            <Link
              to={`/product/${product.slug}`}
              className="px-4 md:px-6 py-2 md:py-2.5 bg-white/95 backdrop-blur-sm rounded-lg font-semibold text-xs md:text-sm shadow-lg transform transition-all duration-300 hover:scale-105"
              style={{ 
                color: 'var(--primary-color, #1a1d20)',
                borderColor: 'var(--accent-color, #D4AF37)',
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
              aria-label="View product"
            >
              View Details
            </Link>
          </div>
        </div>

        {/* Elegant badges with gold accents - Smaller on mobile */}
        {(product.isNew || isBestseller || hasFreeShipping || product.discount) && (
          <div className="absolute top-1.5 md:top-3 left-1.5 md:left-3 flex flex-col gap-1">
            {product.isNew && (
              <div className="text-white text-[8px] md:text-[10px] font-bold px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-full shadow-md" style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}>NEW</div>
            )}
            {isBestseller && (
              <div className="text-primary-900 text-[8px] md:text-[10px] font-bold px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-full shadow-md" style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #f9d77e 100%)' }}>BESTSELLER</div>
            )}
            {hasFreeShipping && (
              <div className="text-white text-[8px] md:text-[10px] font-bold px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-full shadow-md" style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}>FREE SHIP</div>
            )}
          </div>
        )}
        {product.discount && (
          <div className="absolute top-1.5 md:top-3 right-1.5 md:right-3 text-white text-[9px] md:text-xs font-bold px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-full shadow-md" style={{ background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)' }}>-{product.discount}%</div>
        )}
      </div>

      {/* Elegant details section - Compact on mobile */}
      <div className={`${isLarge ? 'p-3 md:p-5' : 'p-2.5 md:p-4'} space-y-1.5 md:space-y-2`}>
        {product.category && (
          <div 
            className="text-[8px] md:text-[10px] font-semibold uppercase tracking-wider" 
            style={{ 
              color: 'var(--accent-color, #D4AF37)', 
              letterSpacing: '0.5px md:1px' 
            }}
          >
            {product.category}
          </div>
        )}

        <Link to={`/product/${product.slug}`} className="block">
          <h3 
            className={`font-semibold ${isLarge ? 'text-lg md:text-xl' : 'text-base md:text-lg'} line-clamp-2 transition-colors duration-200`}
            style={{ 
              fontFamily: 'Cormorant Garamond, serif',
              color: 'var(--primary-color, #0d0c0eff)',
              lineHeight: '1.3'
            }}
          >
            {product.name}
          </h3>
        </Link>

        {/* Rating with gold stars - Smaller on mobile */}
        <div className="mt-1 md:mt-1.5 scale-90 md:scale-100 origin-left">{renderStars(avgRating)}</div>

        <div className="flex items-center justify-between mt-1.5 md:mt-2 pt-1.5 md:pt-2 border-t border-neutral-100">
          <div className="flex flex-col gap-0.5">
            <span 
              className={`font-bold ${isLarge ? 'text-sm md:text-lg' : 'text-sm md:text-base'}`}
              style={{ 
                color: 'var(--primary-color, #1a1d20)',
                fontFamily: 'Montserrat, sans-serif'
              }}
            >
              {formatPrice(product.price)}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-[10px] md:text-xs text-neutral-400 line-through">{formatPrice(product.originalPrice)}</span>
            )}
          </div>

          <button
            onClick={handleAddToCart}
            disabled={isLoading || !inStock}
            className={`px-2 md:px-4 py-1.5 md:py-2 text-[10px] md:text-xs font-semibold rounded-md md:rounded-lg transition-all duration-300 ${
              isLoading || !inStock 
                ? "opacity-50 cursor-not-allowed bg-neutral-200 text-neutral-500" 
                : "hover:shadow-lg transform hover:-translate-y-0.5"
            }`}
            style={{ 
              letterSpacing: '0.3px',
              ...(!(isLoading || !inStock) && {
                background: 'var(--accent-color, linear-gradient(to right, #D4AF37, #f9d77e))',
                color: 'var(--primary-color, #1a1d20)'
              })
            }}
          >
            {isLoading ? "..." : inStock ? "ADD" : "OUT"}
          </button>
        </div>

        {/* Stock indicator - Smaller on mobile */}
        {lowStock && (
          <div className="flex items-center gap-1 md:gap-1.5 mt-1.5 md:mt-2 text-[10px] md:text-xs">
            <span className="w-1 h-1 md:w-1.5 md:h-1.5 bg-red-500 rounded-full animate-pulse"></span>
            <span className="text-red-600 font-medium">Only {stock} left</span>
          </div>
        )}
      </div>
    </div>
  );
}