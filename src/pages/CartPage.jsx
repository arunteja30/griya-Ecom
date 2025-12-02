import React, { useContext, useEffect, useState } from "react";
import { CartContext } from "../context/CartContext";
import { useFirebaseObject, useFirebaseList } from "../hooks/useFirebase";
import Loader from "../components/Loader";
import Modal from "../components/Modal";
import { showToast } from "../components/Toast";
import { normalizeImageUrl } from '../utils/imageHelpers'; 
import { useNavigate, Link } from 'react-router-dom';
import UniversalImage from "../components/UniversalImage";

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
    // compute promo and delivery local values to avoid ordering issues
    const promo = appliedPromo;
    const promoAmount = promo ? (promo.type === 'percent' ? Math.round((cartTotal * (Number(promo.amount) || 0)) / 100) : Math.round(Number(promo.amount) || 0)) : 0;
    const discounted = Math.max(0, cartTotal - promoAmount);
    const minPurchaseLocal = Number(siteSettings?.minPurchaseAmount || 0);
    const freeShipEnabledLocal = siteSettings?.freeShippingEnabled !== false;
    const freeShipThresholdLocal = Number(siteSettings?.freeShippingThreshold || 0);
    const qualifiesFreeShipLocal = freeShipEnabledLocal && freeShipThresholdLocal > 0 && discounted >= freeShipThresholdLocal;
    const deliveryEnabledLocal = siteSettings?.deliveryEnabled !== false;
    const deliveryAmtLocal = Number(siteSettings?.deliveryChargeAmount || 0);
    const deliveryChargeLocal = deliveryEnabledLocal ? (qualifiesFreeShipLocal ? 0 : deliveryAmtLocal) : 0;
    const finalTotalLocal = Math.max(0, discounted + deliveryChargeLocal);

    let lines = [
      `Hello, I would like to place an order from ${siteSettings?.siteName || 'your store'}`,
      "",
      "Order details:"
    ];

    cartItems.forEach((item, idx) => {
      const p = item.product || item;
      lines.push(`${idx + 1}. ${p.name} x ${item.quantity} - ₹${p.price}`);
    });

    lines.push('', `Subtotal: ₹${cartTotal}`);
    if (promoAmount > 0) lines.push(`Discount: -₹${promoAmount}`);
    if (deliveryChargeLocal > 0) lines.push(`Delivery: ₹${deliveryChargeLocal}`);
    lines.push(`Total: ₹${finalTotalLocal}`);
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
  // Site-level rules
  const minPurchase = Number(siteSettings?.minPurchaseAmount || 0);
  const freeShippingEnabled = siteSettings?.freeShippingEnabled !== false;
  const freeShippingThreshold = Number(siteSettings?.freeShippingThreshold || 0);
  const qualifiesFreeShipping = freeShippingEnabled && freeShippingThreshold > 0 && discountedTotal >= freeShippingThreshold;
  const deliveryEnabled = siteSettings?.deliveryEnabled !== false;
  const deliveryChargeAmount = Number(siteSettings?.deliveryChargeAmount || 0);
  const deliveryCharge = deliveryEnabled ? (qualifiesFreeShipping ? 0 : deliveryChargeAmount) : 0;
  const finalTotal = Math.max(0, discountedTotal + deliveryCharge);
  const canCheckout = discountedTotal >= Math.max(0, minPurchase);

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
    <div className="space-y-2 mt-6" style={{ paddingBottom: cartItems.length > 0 ? 'calc(env(safe-area-inset-bottom, 0px) + 96px)' : undefined }}>
      <div className="mt-2 flex items-center justify-between">
        <div className="mt-6 flex items-center gap-3">
        
          <h1 className="text-2xl font-semibold">Your Cart</h1>
        </div>
      <div className="mt-6 text-sm text-neutral-600">{cartItems.length} item(s)</div>
      </div>

      {cartItems.length === 0 ? (
        <div className="card p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
          <p className="text-neutral-600 mb-6">Explore our collections and add items you love.</p>
          <Link to="/collections" className="btn btn-secondary">Browse Collections</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => (
              <div key={item.id} className="card flex items-center gap-4 p-4">
                <Link to={`/product/${item.product?.slug}`} className="block flex-shrink-0">
                  <UniversalImage src={normalizeImageUrl(item.product?.images?.[0]) || '/placeholder.jpg'} className="w-20 h-20 sm:w-28 sm:h-28 object-cover rounded-lg" alt={item.product?.name} fallback={'/placeholder.jpg'} />
                </Link>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <Link to={`/product/${item.product?.slug}`} className="font-semibold text-base line-clamp-2 block">{item.product?.name}</Link>
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
              <div className="text-lg font-semibold">Subtotal: ₹{cartTotal}</div>
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

              {/* Minimum purchase & free-shipping notices (display above total) */}
              {minPurchase > 0 && !canCheckout && (
                <div className="mb-2 text-sm text-red-600">Minimum order ₹{minPurchase} required to checkout. Add ₹{Math.max(0, minPurchase - discountedTotal)} more.</div>
              )}
              {minPurchase > 0 && canCheckout && (
                <div className="mb-2 text-sm text-green-600"></div>
              )}
              {freeShippingEnabled && freeShippingThreshold > 0 && !qualifiesFreeShipping && (
                <div className="mb-2 text-sm text-neutral-500">Add ₹{Math.max(0, freeShippingThreshold - discountedTotal)} more for free shipping</div>
              )}
              {freeShippingEnabled && freeShippingThreshold > 0 && qualifiesFreeShipping && (
                <div className="mb-2 text-sm text-green-600">You are Eligible for free shipping</div>
              )}

              {deliveryEnabled && deliveryCharge > 0 && (
                <div className="mb-2 text-sm text-neutral-700">Delivery: ₹{deliveryCharge}</div>
              )}

              <div className="mb-4 font-semibold">Total: ₹{finalTotal}</div>
              <div className="space-y-2">
                
                <button onClick={() => navigate('/checkout')} disabled={!canCheckout} className={`w-full btn btn-primary text-dark py-2 rounded ${!canCheckout? 'opacity-50 cursor-not-allowed':''}`}>Proceed to Checkout</button>
               
               </div>
             </div>
           </aside>
         </div>
       )}

      {/* Mobile bottom bar (only when cart has items) */}
      {cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white p-3 border-t flex items-center z-40">
          <div className="flex-1 pr-3">
            <div className="text-sm text-neutral-600">Total</div>
            <div className="font-semibold">₹{finalTotal}</div>
            {deliveryEnabled && deliveryCharge>0 && (
              <div className="text-xs text-neutral-500">Includes delivery ₹{deliveryCharge}</div>
            )}
            {freeShippingEnabled && freeShippingThreshold>0 && !qualifiesFreeShipping && (
              <div className="text-xs text-neutral-500">Add ₹{Math.max(0, freeShippingThreshold - discountedTotal)} more for free shipping</div>
            )}
            {qualifiesFreeShipping && (
              <div className="text-xs text-green-600">You qualify for free shipping</div>
            )}
          </div>
          <div className="flex items-center gap-2 w-[48%]">
         
            <button onClick={() => navigate('/checkout')} disabled={!canCheckout} className={`flex-1 btn btn-primary text-dark py-2 rounded ${!canCheckout? 'opacity-50 cursor-not-allowed':''}`}>
                Checkout
              </button>
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