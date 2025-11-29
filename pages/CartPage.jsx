import React, { useState } from "react";
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from "../context/CartContext";
import Loader from "../components/Loader";
import Modal from "../components/Modal";
import { showToast } from "../components/Toast";
import { normalizeImageUrl } from '../utils/imageHelpers';
import { useFirebaseObject } from '../hooks/useFirebase';

export default function CartPage() {
  const { cartItems = [], cartTotal = 0, updateQuantity, removeFromCart, clearCart } = useCart() || {};
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const navigate = useNavigate();
  const { data: siteSettings } = useFirebaseObject('/siteSettings');
  const theme = siteSettings?.theme || {};
  const cardStyle = {
    background: theme.cardBgColor || undefined,
    color: theme.cardTextColor || undefined,
    border: `1px solid ${theme.cardBorderColor || '#efefef'}`,
  };
  const primaryBtnBg = theme.cardButtonPrimaryBg || theme.primaryColor;
  const accentBtnBg = theme.cardButtonAccentBg || theme.accentColor;

  const MIN_ORDER = 350;

  // Simple formatter
  const formatINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  const confirmClear = () => setShowConfirmClear(true);
  const doClear = () => {
    clearCart();
    setShowConfirmClear(false);
    showToast('Cart cleared');
  };

  const openWhatsApp = () => {
    const whatsappNumber = String(siteSettings?.whatsapp || siteSettings?.phone || '');
    const cleaned = whatsappNumber.replace(/[^0-9+]/g, '').replace(/^\+/, '');
    if (!cleaned) {
      showToast('WhatsApp number not configured', 'error');
      return;
    }

    if ((cartTotal || 0) < MIN_ORDER) {
      showToast(`Minimum order value is ₹${MIN_ORDER}`, 'error');
      return;
    }

    const lines = [];
    lines.push(`Hello${siteSettings?.siteName ? ' from ' + siteSettings.siteName : ''}, I would like to place an order:`);
    lines.push('');
    lines.push('Order details:');
    cartItems.forEach((item, idx) => {
      const p = item.product || item;
      lines.push(`${idx + 1}. ${p.name} x ${item.quantity} - ₹${p.price || 0}`);
    });
    lines.push('');
    lines.push(`Total: ₹${cartTotal}`);
    lines.push('');
    lines.push('Please reply with payment and delivery instructions.');

    const msg = encodeURIComponent(lines.join('\n'));
    const url = `https://wa.me/${cleaned}?text=${msg}`;
    window.open(url, '_blank');
  };

  if (!cartItems) return <Loader />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {cartItems.length === 0 ? (
        <div className="rounded-xl p-12 text-center shadow-sm" style={cardStyle}>
          <div className="text-6xl mb-4">🛒</div>
          <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
          <p className="mb-6" style={{ color: theme.cardTextColor || undefined }}>Start adding items to see them here</p>
          <div className="flex justify-center gap-3">
            <Link to="/" className="px-6 py-3 rounded-lg font-medium transition-colors" style={{ background: primaryBtnBg, color: '#ffffff' }}>
              Go to Home
            </Link>
            <Link to="/groceries" className="px-6 py-3 rounded-lg font-medium transition-colors" style={{ border: `1px solid ${theme.cardBorderColor || '#e5e7eb'}`, color: theme.cardTextColor || undefined }}>
              Browse Groceries
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => {
              const p = item.product || item;
              return (
                <div key={item.id} className="rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow" style={cardStyle}>
                  <div className="flex items-center gap-4">
                    <img 
                      src={normalizeImageUrl(p.images?.[0]) || '/placeholder.jpg'} 
                      className="w-20 h-20 object-cover rounded-lg" 
                      alt={p.name} 
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-800">{p.name}</h3>
                          {(p.unit || p.variant) && (
                            <div className="text-sm text-gray-500">{p.unit || p.variant}</div>
                          )}
                          <div className="text-lg font-bold text-gray-800 mt-1">{formatINR(p.price)}</div>
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.id)} 
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          aria-label="Remove item"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center bg-gray-50 rounded-lg">
                          <button 
                            onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} 
                            className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
                            aria-label="Decrease quantity"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>
                          <input 
                            type="number" 
                            min={1} 
                            value={item.quantity} 
                            onChange={(e) => updateQuantity(item.id, Math.max(1, Number(e.target.value || 1)))} 
                            className="w-16 text-center border-0 bg-transparent font-medium text-gray-800 focus:outline-none"
                            id={`quantity-${item.id}`}
                            name={`quantity-${item.id}`}
                          />
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity + 1)} 
                            className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
                            aria-label="Increase quantity"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </button>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-500">Subtotal</div>
                          <div className="font-semibold text-gray-800">{formatINR((p.price || 0) * (item.quantity || 1))}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="rounded-xl p-6 shadow-sm h-fit sticky top-6" style={cardStyle}>
            <h3 className="font-semibold text-lg mb-4">Order Summary</h3>
            
            <div className="space-y-3 mb-6">
              
              <div className="border-t pt-3">
                <div className="flex justify-between font-semibold text-lg text-gray-800">
                  <span>Total</span>
                  <span>{formatINR(cartTotal)}</span>
                </div>
              </div>
              {(cartTotal || 0) < MIN_ORDER && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  Minimum order amount is ₹{MIN_ORDER}. Add ₹{MIN_ORDER - (cartTotal || 0)} more to proceed.
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={() => navigate('/checkout')} 
                disabled={(cartTotal || 0) < MIN_ORDER}
                className="w-full disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors"
                style={{ background: primaryBtnBg, opacity: (cartTotal || 0) < MIN_ORDER ? 0.6 : 1 }}
              >
                Proceed to Checkout
              </button>
              <button  
                onClick={openWhatsApp} 
                disabled={(cartTotal || 0) < MIN_ORDER}
                className="hidden w-full disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                style={{ background: accentBtnBg, opacity: (cartTotal || 0) < MIN_ORDER ? 0.6 : 1 }}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.097"/>
                </svg>
                WhatsApp Order
              </button>
              <Link 
                to="/groceries" 
                className="w-full block text-center py-3 rounded-lg font-medium transition-colors"
                style={{ border: `1px solid ${theme.cardBorderColor || '#e5e7eb'}`, color: theme.cardTextColor || undefined }}
              >
                Continue Shopping
              </Link>
             </div>
             
             <button 
               onClick={confirmClear} 
               className="w-full mt-4 text-sm text-red-600 hover:text-red-700 transition-colors"
             >
               Clear entire cart
             </button>
           </aside>
         </div>
       )}

      <Modal isOpen={showConfirmClear} hideActions onClose={()=>setShowConfirmClear(false)} title="Clear cart?">
        <p>Are you sure you want to clear your cart? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="px-4 py-2" onClick={()=>setShowConfirmClear(false)}>Cancel</button>
          <button className="px-4 py-2 bg-red-600 text-white rounded" onClick={doClear}>Clear</button>
        </div>
      </Modal>
    </div>
  );
}
