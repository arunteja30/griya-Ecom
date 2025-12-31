import React from 'react';
import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import ProductCard from '../components/ProductCard';

export default function WishlistPage() {
  const { wishlist, clearWishlist, wishlistCount } = useWishlist();

  if (wishlistCount === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-mobile">
        <div className="text-center space-y-6">
          <div className="text-8xl mb-4">💚</div>
          <h1 className="text-2xl font-bold text-surface-900">Your Wishlist is Empty</h1>
          <p className="text-surface-600 max-w-sm">
            Save products you love by clicking the heart icon on any product card.
          </p>
          <Link
            to="/"
            className="btn-primary inline-flex items-center gap-2 px-6 py-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-safe">
      {/* Header */}
      <div className="px-mobile py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-900">My Wishlist</h1>
            <p className="text-surface-600">{wishlistCount} item{wishlistCount !== 1 ? 's' : ''} saved</p>
          </div>
          {wishlistCount > 0 && (
            <button
              onClick={clearWishlist}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Wishlist Grid */}
      <div className="px-mobile">
        <div className="product-grid">
          {wishlist.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>

      {/* Continue Shopping */}
      <div className="px-mobile py-8">
        <Link
          to="/"
          className="btn-outline w-full flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}