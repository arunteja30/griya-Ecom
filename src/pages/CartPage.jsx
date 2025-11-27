import React, { useContext, useEffect, useState } from "react";
import { CartContext } from "../context/CartContext";
import { useFirebaseObject, useFirebaseList } from "../hooks/useFirebase";
import Loader from "../components/Loader";
import Modal from "../components/Modal";
import { showToast } from "../components/Toast";
import { normalizeImageUrl } from '../utils/imageHelpers'; 
import { useNavigate } from 'react-router-dom';

export default function CartPage() {
  const { cartItems, cartTotal, updateQuantity, removeFromCart, clearCart, appliedPromo, appliedPromoKey, applyPromo, clearPromo } = useContext(CartContext);
  const { data: siteSettings, loading } = useFirebaseObject("/siteSettings");
  const { data: promoData } = useFirebaseList('/promoCodes');
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState(null);
  const navigate = useNavigate();

  if (loading) return <Loader />;

  const whatsappNumber = String(siteSettings?.whatsapp || siteSettings?.whatapp || '');
  const cleaned = whatsappNumber.replace(/[^0-9+]/g, '');

  const buildWhatsAppMessage = () => {
    let lines = [
      `Hello, I would like to place an order from ${siteSettings?.siteName || 'your store'}`,
      "",
      "Order details:"
    ];

    cartItems.forEach((item, idx) => {
      const p = item.product || item;
      lines.push(`${idx + 1}. ${p.name} x ${item.quantity} - ₹${p.price}`);
    });

    lines.push("", `Total: ₹${cartTotal}`);
    if (siteSettings?.address) lines.push(`Deliver to: ${siteSettings.address}`);

    return encodeURIComponent(lines.join('\n'));
  };

  const handleCheckout = () => {
    const msg = buildWhatsAppMessage();
    const url = `https://wa.me/${cleaned}?text=${msg}`;
    window.open(url, "_blank");
  };

  const confirmClear = () => {
    setShowConfirmClear(true);
  };

  const doClear = () => {
    clearCart();
    setShowConfirmClear(false);
    showToast('Cart cleared');
  };

  const computeDiscount = (total, promo) => {
    if (!promo) return 0;
    const amount = Number(promo.amount) || 0;
    if (promo.type === 'percent') return Math.round((total * amount) / 100);
    return Math.round(amount);
  };

  const discountedAmount = computeDiscount(cartTotal, appliedPromo);
  const discountedTotal = Math.max(0, cartTotal - discountedAmount);

  const handleApply = () => {
    setPromoError(null);
    const code = (promoInput || '').trim().toUpperCase();
    if (!code) return setPromoError('Enter a promo code');
    if (!promoData) return setPromoError('Promo codes not available');

    let foundKey = null; let found = null;
    if (Array.isArray(promoData)) {
      promoData.forEach((p, idx)=>{ if (p?.code?.toUpperCase?.()===code) { found = p; foundKey = idx; } });
    } else {
      for (const [k,v] of Object.entries(promoData)) { if (String(v.code||'').toUpperCase()===code) { found = v; foundKey = k; break; } }
    }
    if (!found) return setPromoError('Invalid promo code');
    if (found.active === false) return setPromoError('Promo is inactive');
    const used = Number(found.used || 0); const max = Number(found.maxUses || 0);
    if (max > 0 && used >= max) return setPromoError('PROMOCODE EXPIRED or INVALID');
    applyPromo(foundKey, found);
  };

  // --- with toast notifications ---
  const handleApplyWithToast = () => {
    setPromoError(null);
    const code = (promoInput || '').trim().toUpperCase();
    if (!code) { setPromoError('Enter a promo code'); showToast('Enter a promo code', 'error'); return; }
    if (!promoData) { setPromoError('Promo codes not available'); showToast('Promo codes not available', 'error'); return; }

    let foundKey = null; let found = null;
    if (Array.isArray(promoData)) {
      promoData.forEach((p, idx)=>{ if (p?.code?.toUpperCase?.()===code) { found = p; foundKey = idx; } });
    } else {
      for (const [k,v] of Object.entries(promoData)) { if (String(v.code||'').toUpperCase()===code) { found = v; foundKey = k; break; } }
    }
    if (!found) { setPromoError('Invalid promo code'); showToast('Invalid promo code', 'error'); return; }
    if (found.active === false) { setPromoError('Promo is inactive'); showToast('Promo is inactive', 'error'); return; }
    const used = Number(found.used || 0); const max = Number(found.maxUses || 0);
    if (max > 0 && used >= max) { setPromoError('PROMOCODE EXPIRED or INVALID'); showToast('PROMOCODE EXPIRED or INVALID', 'error'); return; }

    applyPromo(foundKey, found);
    showToast('Promo applied', 'success');
  };

  const handleClearPromo = () => { setPromoInput(''); setPromoError(null); clearPromo(); showToast('Promo cleared', 'info'); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your Cart</h1>
        <div className="text-sm text-neutral-600">{cartItems.length} item(s)</div>
      </div>

      {cartItems.length === 0 ? (
        <div className="card p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
          <p className="text-neutral-600 mb-6">Explore our collections and add items you love.</p>
          <a href="/collections" className="btn btn-secondary">Browse Collections</a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => (
              <div key={item.id} className="card flex items-center gap-4 p-4">
                <img src={normalizeImageUrl(item.product?.images?.[0]) || '/placeholder.jpg'} className="w-20 h-20 sm:w-28 sm:h-28 object-cover rounded-lg" alt={item.product?.name} />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-semibold text-base line-clamp-2">{item.product?.name}</div>
                      <div className="text-sm text-neutral-500">{item.product?.variant || ''}</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="font-semibold">₹{item.product?.price}</div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button aria-label="Decrease quantity" onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="px-2 py-1 rounded-lg border bg-white">-</button>
                      <span className="px-3 py-1 border rounded-md">{item.quantity}</span>
                      <button aria-label="Increase quantity" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2 py-1 rounded-lg border bg-white">+</button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right sm:hidden">
                        <div className="font-semibold">₹{item.product?.price}</div>
                      </div>
                      <button onClick={()=>removeFromCart(item.id)} className="text-red-600 p-2 rounded" aria-label="Remove item">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6h18M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between">
              <button onClick={confirmClear} className="text-sm text-red-600">Clear cart</button>
              <div className="text-lg font-semibold">Total: ₹{cartTotal}</div>
            </div>
          </div>

          <aside className="card-glass p-6 rounded-lg shadow-md hidden lg:block">
            <div className="sticky top-24">
              <h3 className="font-semibold text-lg mb-2">Order Summary</h3>
              <div className="mb-4 text-sm text-neutral-600">Items: {cartItems.length}</div>
              {/* subtotal removed - show total only below */}
              <div className="mb-2">
                <div className="flex items-center gap-2">
                  <input className="form-input" placeholder="Promo code" value={promoInput} onChange={(e)=>setPromoInput(e.target.value)} />
                  <button onClick={handleApplyWithToast} className="btn btn-outline">Apply</button>
                  <button onClick={handleClearPromo} className="btn btn-ghost">Clear</button>
                </div>
                {promoError && <div className="text-sm text-red-600">{promoError}</div>}
                {appliedPromo && (
                  <div className="text-sm text-green-700 mt-2">Applied: {appliedPromo.code} — Discount: {appliedPromo.type==='percent'?`${appliedPromo.amount}%`:`₹${appliedPromo.amount}`}</div>
                )}
              </div>
              <div className="mb-4 font-semibold">Total: ₹{discountedTotal}</div>
              <div className="space-y-2">
                {siteSettings?.enableWhatsAppCheckout !== false && (
                  <button onClick={handleCheckout} className="w-full bg-green-600 text-white py-2 rounded">Checkout via WhatsApp</button>
                )}
                {siteSettings?.enableRazorpayCheckout !== false && (
                  <button onClick={() => navigate('/checkout')} className="w-full bg-primary-500 text-white py-2 rounded">Proceed to Checkout</button>
                )}
                {siteSettings?.enableWhatsAppCheckout === false && siteSettings?.enableRazorpayCheckout === false && (
                  <div className="text-sm text-neutral-500">Online checkout is currently disabled. Please contact support to place an order.</div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Mobile bottom bar (only when cart has items) */}
      {cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white p-3 border-t flex items-center justify-between z-40">
          <div>
            <div className="text-sm text-neutral-600">Total</div>
            <div className="font-semibold">₹{discountedTotal}</div>
          </div>
          <div className="flex items-center gap-2">
            {siteSettings?.enableWhatsAppCheckout !== false && <button onClick={handleCheckout} className="bg-green-600 text-white py-2 px-3 rounded">WhatsApp</button>}
            {siteSettings?.enableRazorpayCheckout !== false && <button onClick={() => navigate('/checkout')} className="bg-primary-500 text-white py-2 px-3 rounded">Checkout</button>}
          </div>
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
