import React, { useState } from "react";
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from "../context/CartContext";
import Loader from "../components/Loader";
import Modal from "../components/Modal";
import { showToast } from "../components/Toast";
import { normalizeImageUrl } from '../utils/imageHelpers';
import { useFirebaseObject, useFirebaseList } from '../hooks/useFirebase';
import { isStoreOpen, getStoreStatus } from '../utils/storeHours';

export default function CartPage() {
  const { cartItems = [], cartTotal = 0, updateQuantity, removeFromCart, clearCart } = useCart() || {};
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const navigate = useNavigate();
  const { data: siteSettings } = useFirebaseObject('/siteSettings');
  const { data: bannersData } = useFirebaseList('/banners');

  const MIN_ORDER = 350;
  const deliveryFee = 0; // Free delivery
  const convenienceFee = 15;
  const totalAmount = cartTotal + deliveryFee + convenienceFee;
  
  // Get store status
  const storeStatus = getStoreStatus(siteSettings);
  const isStoreClosed = storeStatus && !storeStatus.isOpen;

  // Simple formatter
  const formatINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  const confirmClear = () => setShowConfirmClear(true);
  const doClear = () => {
    clearCart();
    setShowConfirmClear(false);
    showToast('Cart cleared');
  };



  if (!cartItems) return <Loader />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 to-surface-100">
      {/* Header */}
      <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-surface-200/50">
        <div className="px-mobile py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-surface-900">Cart</h1>
            {cartItems.length > 0 && (
              <span className="badge-primary px-2 py-1 text-xs">
                {cartItems.length} item{cartItems.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {cartItems.length > 0 && (
            <button 
              onClick={confirmClear} 
              className="text-red-500 hover:text-red-600 text-sm font-medium transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {cartItems.length === 0 ? (
        // Empty Cart State
        <div className="flex-1 flex items-center justify-center px-mobile py-12">
          <div className="text-center space-y-6 max-w-sm mx-auto">
            <div className="relative">
              <div className="w-32 h-32 bg-gradient-to-br from-surface-100 to-surface-200 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-16 h-16 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5-6M16 16a2 2 0 100 4 2 2 0 000-4zm0 0V9a2 2 0 00-2-2H9m8 7a2 2 0 01-2 2H9a2 2 0 01-2-2" />
                </svg>
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                </svg>
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-surface-900">Your cart is empty</h2>
              <p className="text-surface-600 leading-relaxed">
                Add items from our fresh collection to get started on your grocery journey
              </p>
            </div>

            <div className="space-y-3">
              <Link to="/" className="btn-primary w-full py-3 text-base font-semibold">
                🏠 Browse Home
              </Link>
              <Link to="/groceries" className="btn-ghost w-full py-3 text-base font-semibold">
                🥬 Explore Groceries
              </Link>
            </div>
          </div>
        </div>
      ) : (
        // Cart Content
        <div className="pb-32">
          {/* Delivery Info Banner */}
          <div className="px-mobile py-4">
            <div className="bg-gradient-to-r from-fresh-50 to-primary-50 border border-fresh-200/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-fresh-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zM10 6a2 2 0 0 1 4 0v1h-4V6zm8 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9h2v1a1 1 0 0 0 2 0V9h4v1a1 1 0 0 0 2 0V9h2v10z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-surface-900">Free delivery on your order!</p>
                  <p className="text-sm text-surface-600">Get fresh groceries delivered in 10-30 mins</p>
                </div>
                <div className="text-2xl">🚀</div>
              </div>
            </div>
          </div>

          {/* Cart Items */}
          <div className="px-mobile space-y-3">
            {cartItems.map((item) => {
              const p = item.product || item;
              const subtotal = (p.price || 0) * (item.quantity || 1);
              
              return (
                <div key={item.id} className="card p-4 hover:shadow-soft transition-all duration-200">
                  <div className="flex gap-3">
                    {/* Product Image */}
                    <div className="flex-shrink-0">
                      <img 
                        src={normalizeImageUrl(p.images?.[0]) || '/placeholder.jpg'} 
                        className="w-16 h-16 object-cover rounded-lg border border-surface-200" 
                        alt={p.name} 
                      />
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-surface-900 truncate">{p.name}</h3>
                          {(p.unit || p.variant) && (
                            <p className="text-xs text-surface-500 mt-1">{p.unit || p.variant}</p>
                          )}
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.id)} 
                          className="p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500 transition-colors"
                          aria-label="Remove item"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                      {/* Stock Warning */}
                      {p.stock !== undefined && p.stock !== null && p.stock <= 5 && (
                        <div className="mt-2 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                          {p.stock === 0 ? 'Out of stock' : `Only ${p.stock} left in stock`}
                        </div>
                      )}

                      {/* Price and Quantity Controls */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center bg-surface-100 rounded-lg">
                          <button 
                            onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} 
                            className="w-8 h-8 flex items-center justify-center text-surface-600 hover:text-primary-600 transition-colors"
                            aria-label="Decrease quantity"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>
                          <div className="w-10 text-center font-semibold text-sm text-surface-900">
                            {item.quantity}
                          </div>
                          <button 
                            onClick={() => {
                              const newQty = item.quantity + 1;
                              // Check stock limit before allowing increase
                              if (p.stock === undefined || p.stock === null || newQty <= p.stock) {
                                updateQuantity(item.id, newQty);
                              } else {
                                showToast(`Only ${p.stock} items available`, 'warning');
                              }
                            }}
                            className="w-8 h-8 flex items-center justify-center text-surface-600 hover:text-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={p.stock !== undefined && p.stock !== null && item.quantity >= p.stock}
                            aria-label="Increase quantity"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </button>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm font-semibold text-surface-900">
                            ₹{subtotal.toFixed(0)}
                          </div>
                          <div className="text-xs text-surface-500">
                            ₹{p.price} each
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add More Items */}
          <div className="px-mobile mt-6">
            <Link to="/" className="card p-4 flex items-center justify-between hover:shadow-soft transition-all duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-surface-900">Add more items</p>
                  <p className="text-xs text-surface-500">Browse our fresh collection</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      {/* Bottom Checkout Bar - Fixed */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-surface-200/50 safe-area-inset-bottom">
          <div className="px-mobile py-4">
            {/* Bill Details */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-surface-600">Item total</span>
                <span className="text-surface-900 font-medium">{formatINR(cartTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-600">Delivery fee</span>
                <span className="text-fresh-600 font-medium">FREE</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-600">Platform fee</span>
                <span className="text-surface-900 font-medium">{formatINR(convenienceFee)}</span>
              </div>
              <div className="border-t border-surface-200 pt-2 flex justify-between">
                <span className="font-bold text-surface-900">Total</span>
                <span className="font-bold text-surface-900">{formatINR(totalAmount)}</span>
              </div>
            </div>

            {/* Minimum Order Warning */}
            {(cartTotal || 0) < MIN_ORDER && (
              <div className="bg-accent-coral/10 border border-accent-coral/30 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-accent-coral mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  <p className="text-sm text-accent-coral">
                    Add items worth <span className="font-semibold">₹{MIN_ORDER - (cartTotal || 0)}</span> more for minimum order of ₹{MIN_ORDER}
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="w-full space-y-3">
              {isStoreClosed && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <div className="text-red-700 text-sm mb-1">Store Closed</div>
                  <div className="text-red-600 text-xs">{storeStatus.message}</div>
                </div>
              )}
              <button 
                onClick={() => {
                  if (isStoreClosed) {
                    showToast('Store is currently closed', 'error');
                    return;
                  }
                  navigate('/checkout');
                }} 
                disabled={(cartTotal || 0) < MIN_ORDER || isStoreClosed}
                className="w-full btn-primary py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isStoreClosed ? 'Store Closed' : 'Proceed to Checkout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal isOpen={showConfirmClear} hideActions onClose={() => setShowConfirmClear(false)} title="Clear cart?">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <p className="text-surface-700">Are you sure you want to clear your entire cart? This action cannot be undone.</p>
          <div className="flex gap-3 pt-2">
            <button 
              className="flex-1 btn-ghost py-2"
              onClick={() => setShowConfirmClear(false)}
            >
              Cancel
            </button>
            <button 
              className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-medium transition-colors"
              onClick={doClear}
            >
              Clear Cart
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
