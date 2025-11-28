import React, { useContext, useState } from "react";
import { Link } from "react-router-dom";
import { CartContext } from "../context/CartContext";
import { showToast } from "./Toast";
import { normalizeImageUrl } from "../utils/imageHelpers";

export default function ProductCard({ product, variant = 'normal' }) {
  const { addToCart } = useContext(CartContext);
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isLarge = variant === 'large' || variant === 'lg';

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
          <svg key={i} className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" style={{ color: 'var(--pc-star, #F59E0B)' }}>
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.974a1 1 0 00.95.69h4.18c.969 0 1.371 1.24.588 1.81l-3.387 2.46a1 1 0 00-.364 1.118l1.287 3.974c.3.921-.755 1.688-1.54 1.118L10 15.347l-3.387 2.46c-.785.57-1.84-.197-1.54-1.118l1.287-3.974a1 1 0 00-.364-1.118L2.609 9.4c-.783-.57-.38-1.81.588-1.81h4.18a1 1 0 00.95-.69L9.05 2.927z" />
          </svg>
        );
      } else if (i === full && half) {
        stars.push(
          <svg key={i} className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" style={{ color: 'var(--pc-star, #F59E0B)' }}>
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
      className="product-card card group overflow-hidden"
      style={{ background: 'var(--pc-card-bg, white)' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Compact image area */}
      <div className={`relative overflow-hidden ${isLarge ? 'h-48 md:h-56' : 'h-36 md:h-40'} flex items-center justify-center`} style={{ background: 'var(--pc-image-bg, #f3f4f6)' }}>
        {/* Use object-cover to fill the area while keeping center; slight scale on hover for subtle effect */}
        <img
          className="w-full h-full object-cover object-center transition-transform duration-300 ease-out group-hover:scale-105"
          src={normalizeImageUrl(product.images?.[0] || "/placeholder.jpg")}
          alt={product.name}
          draggable={false}
        />

        {/* Hover quick action - stays centered */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${isHovered ? "opacity-100" : "opacity-0"}`}>
          <Link
            to={`/product/${product.slug}`}
            className={`btn btn-secondary ${isLarge ? 'btn-lg' : 'btn-sm'} bg-white/90 text-neutral-800 shadow-sm`}
            aria-label="View product"
          >
            View
          </Link>
        </div>
      </div>

      {/* Badges row (placed below image) */}
      {(product.isNew || isBestseller || hasFreeShipping || product.discount) && (
        <div className="flex items-center gap-2 mt-2">
          {product.isNew && (
            <div className="text-white text-[10px] ml-2 font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--pc-badge-new, #10B981)' }}>New</div>
          )}
          {isBestseller && (
            <div className="text-white text-[10px] ml-2 font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--pc-badge-bestseller, #F59E0B)' }}>Bestseller</div>
          )}
          {hasFreeShipping && (
            <div className="text-white text-[10px] ml-2 font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--pc-badge-new, #10B981)' }}>Free shipping</div>
          )}
          {product.discount && (
            <div className="text-white text-[10px] ml-2 font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--pc-badge-discount, #DC2626)' }}>-{product.discount}%</div>
          )}
        </div>
      )}

      {/* Compact details */}
      <div className={`p-3 space-y-1 ${isLarge ? 'p-4' : ''}`}>
        {product.category && <div className="text-[11px] text-accent-600 font-semibold uppercase tracking-wide">{product.category}</div>}

        <Link to={`/product/${product.slug}`} className="block">
          <h3 className={`font-semibold text-primary-900 ${isLarge ? 'text-base' : 'text-sm'} line-clamp-2 hover:text-accent-600 transition-colors duration-150`} style={{ color: 'var(--pc-name, #0b2a66)' }}>{product.name}</h3>
        </Link>

        {/* Rating */}
        <div className="mt-1">{renderStars(avgRating)}</div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2">
            <span className={`font-bold ${isLarge ? 'text-lg' : 'text-base'}`} style={{ color: 'var(--pc-price, #0b2a66)' }}>{formatPrice(product.price)}</span>
            {product.originalPrice && product.originalPrice > product.price && <span className="text-sm text-neutral-500 line-through">{formatPrice(product.originalPrice)}</span>}
          </div>

          <button
            onClick={handleAddToCart}
            disabled={isLoading || !inStock}
            className={`btn btn-primary ${isLarge ? 'btn-sm' : 'btn-sm'} ${isLoading || !inStock ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isLoading ? "Adding..." : inStock ? "Add" : "Out"}
          </button>
        </div>

        {/* Tactical notes */}
        <div className="flex items-center justify-between mt-2">
          {lowStock && <div className="text-xs text-red-600 font-medium">Only {stock} left</div>}
          {!inStock && <div className="text-xs text-neutral-500">Out of stock</div>}
        </div>
      </div>
    </div>
  );
}