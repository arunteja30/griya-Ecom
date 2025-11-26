import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import { CartContext } from '../context/CartContext';
import { showToast } from '../components/Toast';
import { useFirebaseList, useFirebaseObject } from '../hooks/useFirebase';

export default function CheckoutPage() {
  const { cartItems, cartTotal, clearCart } = useContext(CartContext);
  const navigate = useNavigate();
  
  // Redirect back to cart if there are no items
  useEffect(() => {
    if (!cartItems || cartItems.length === 0) {
      navigate('/cart');
    }
  }, [cartItems, navigate]);
  const [address, setAddress] = useState({ name: '', email: '', phone: '', line1: '', city: '', state: '', pincode: '' });
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromoKey, setAppliedPromoKey] = useState(null);
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState(null);

  const indianStates = [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'
  ];

  const { data: promoData } = useFirebaseList('/promoCodes');
  const { data: siteSettings } = useFirebaseObject('/siteSettings');

  const isValid = () => {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email || '');
    return (
      address.name.trim() &&
      emailOk &&
      /^\d{6,}$/.test(address.phone.replace(/\D/g, '')) &&
      address.line1.trim() &&
      address.city.trim() &&
      address.state.trim() &&
      /^\d{5,6}$/.test(address.pincode)
    );
  };

  const proceedToPay = async () => {
    if (!isValid()) return showToast('Please complete address details', 'error');
    if (siteSettings?.enableRazorpayCheckout === false) return showToast('Online payments are disabled', 'error');
    setConfirmOpen(true);
  };
  
  const computeDiscount = (total, promo) => {
    if (!promo) return 0;
    const amount = Number(promo.amount) || 0;
    if (promo.type === 'percent') return Math.round((total * amount) / 100);
    return Math.round(amount);
  };
  
  const discountedAmount = computeDiscount(cartTotal, appliedPromo);
  const discountedTotal = Math.max(0, cartTotal - discountedAmount);
  
  const applyPromo = () => {
    setPromoError(null);
    const code = (promoInput || '').trim().toUpperCase();
    if (!code) return setPromoError('Enter a promo code');
    if (!promoData) return setPromoError('Promo codes not available');

    // promoData may be object map or array
    let foundKey = null;
    let found = null;
    if (Array.isArray(promoData)) {
      promoData.forEach((p, idx) => { if (p?.code?.toUpperCase?.() === code) { found = p; foundKey = idx; } });
    } else {
      for (const [k, v] of Object.entries(promoData)) {
        if (String(v.code || '').toUpperCase() === code) { found = v; foundKey = k; break; }
      }
    }

    if (!found) return setPromoError('Invalid promo code');
    if (found.active === false) return setPromoError('Promo code is inactive');
    const used = Number(found.used || 0);
    const max = Number(found.maxUses || 0);
    if (max > 0 && used >= max) return setPromoError('Promo code has no remaining uses');

    setAppliedPromoKey(foundKey);
    setAppliedPromo(found);
    showToast('Promo applied', 'success');
  };

  const startPayment = async () => {
    setConfirmOpen(false);
    setLoading(true);
    try {
      const { loadRazorpayScript, openRazorpayCheckout, createOrderOnServer } = await import('../utils/razorpay');
      await loadRazorpayScript();
      const key = import.meta.env.VITE_RAZORPAY_KEY;
      if (!key) {
        setLoading(false);
        return showToast('Razorpay key not configured', 'error');
      }

      // Create order on server (amount in paise)
      const amountPaise = Math.round(cartTotal * 100);
      const order = await createOrderOnServer(amountPaise);
      if (!order || !order.id) throw new Error('Order creation failed');

      const shippingText = `${address.name}, ${address.line1}, ${address.city}, ${address.state} - ${address.pincode}`;

      openRazorpayCheckout({
        key,
        amountINR: cartTotal,
        orderId: order.id,
        name: 'Griya Jewellery',
        description: `Order Payment. Ship to: ${shippingText}`,
        prefill: { name: address.name, email: address.email, contact: address.phone },
        onSuccess: async (resp) => {
          try {
            // Verify payment on server
            const verifyRes = await fetch((import.meta.env.VITE_API_BASE || 'http://localhost:4000') + '/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(resp)
            });
            const verified = await verifyRes.json();
            
            if (verified.ok) {
              // Save order to Firebase after successful verification
              try {
                const { ref, push } = await import('firebase/database');
                const { db } = await import('../firebase');
                
                // Build order object and ensure no `undefined` values are present
                const orderData = {
                  orderId: resp.razorpay_order_id,
                  paymentId: resp.razorpay_payment_id,
                  signature: resp.razorpay_signature,
                  amount: cartTotal,
                  currency: 'INR',
                  status: 'paid',
                  createdAt: new Date().toISOString(),
                  customer: {
                    name: address.name,
                    email: address.email,
                    phone: address.phone
                  },
                  shipping: {
                    line1: address.line1,
                    city: address.city,
                    state: address.state,
                    pincode: address.pincode
                  },
                  items: cartItems.map(item => ({
                    id: item.id ?? null,
                    name: item.name ?? item.title ?? 'Item',
                    price: item.price ?? 0,
                    quantity: item.quantity ?? 1,
                    image: item.image ?? ''
                  }))
                };

                // Recursively replace any remaining undefined values with null
                const replaceUndefined = (val) => {
                  if (Array.isArray(val)) return val.map(replaceUndefined);
                  if (val && typeof val === 'object') {
                    const out = {};
                    for (const k of Object.keys(val)) {
                      out[k] = replaceUndefined(val[k]);
                    }
                    return out;
                  }
                  return val === undefined ? null : val;
                };

                const safeOrderData = replaceUndefined(orderData);
                await push(ref(db, 'orders'), safeOrderData);
                // If a promo was applied, increment its `used` counter
                try {
                  if (appliedPromoKey) {
                    const promoRef = ref(db, `promoCodes/${appliedPromoKey}`);
                    const { update } = await import('firebase/database');
                    const newUsed = (Number(appliedPromo?.used) || 0) + 1;
                    await update(promoRef, { used: newUsed });
                  }
                } catch (promoErr) {
                  console.warn('Failed to update promo usage', promoErr);
                }
                 setLoading(false);
                 showToast('Payment successful and order saved', 'success');
                 clearCart();
                 navigate('/');
               } catch (firebaseError) {
                console.error('Failed to save order to Firebase:', firebaseError);
                setLoading(false);
                showToast('Payment successful but failed to save order details', 'warning');
                clearCart();
                navigate('/');
              }
            } else {
              setLoading(false);
              showToast('Payment succeeded but verification failed', 'error');
            }
          } catch (e) {
            setLoading(false);
            showToast('Verification error: ' + e.message, 'error');
          }
        },
        onFailure: () => {
          setLoading(false);
          showToast('Payment failed', 'error');
        }
      });
    } catch (err) {
      setLoading(false);
      showToast('Payment could not be started: ' + err.message, 'error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-semibold mb-4">Checkout</h1>
      <div className="card p-6">
        <div className="space-y-4">
          <div>
            <label className="form-label">Full name</label>
            <input className="form-input" value={address.name} onChange={(e)=>setAddress({...address, name: e.target.value})} />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input className="form-input" value={address.email} onChange={(e)=>setAddress({...address, email: e.target.value})} />
          </div>
          <div>
            <label className="form-label">Phone</label>
            <input
              className="form-input"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={15}
              value={address.phone}
              onChange={(e)=>setAddress({...address, phone: e.target.value.replace(/\D/g, '').slice(0,15)})}
            />
          </div>
          <div>
            <label className="form-label">Address line</label>
            <input className="form-input" value={address.line1} onChange={(e)=>setAddress({...address, line1: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">City</label>
              <input className="form-input" value={address.city} onChange={(e)=>setAddress({...address, city: e.target.value})} />
            </div>
            <div>
              <label className="form-label">State</label>
              <select className="form-input" value={address.state} onChange={(e)=>setAddress({...address, state: e.target.value})}>
                <option value="">Select state / union territory</option>
                {indianStates.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Pincode</label>
            <input
              className="form-input"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={address.pincode}
              onChange={(e)=>setAddress({...address, pincode: e.target.value.replace(/\D/g, '').slice(0,6)})}
            />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
            <input className="form-input md:col-span-2" placeholder="Promo code" value={promoInput} onChange={(e)=>setPromoInput(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={applyPromo} className="btn btn-outline">Apply</button>
              <button onClick={()=>{ setPromoInput(''); setAppliedPromo(null); setAppliedPromoKey(null); setPromoError(null); }} className="btn btn-ghost">Clear</button>
            </div>
          </div>
          {promoError && <div className="text-sm text-red-600">{promoError}</div>}
          <div className="flex items-center justify-between">
            <div className="text-sm">Subtotal: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(cartTotal)}</div>
            <div className="text-sm">Discount: -{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(discountedAmount)}</div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Total: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(discountedTotal)}</div>
            <div className="flex items-center gap-3">
              <button onClick={()=>navigate('/cart')} className="btn btn-ghost">Back to Cart</button>
              <button onClick={proceedToPay} disabled={!isValid() || loading || !(cartTotal > 0) || siteSettings?.enableRazorpayCheckout === false} className="btn btn-accent">Proceed to Pay</button>
            </div>
          </div>
        </div>
      </div>

    <Modal isOpen={confirmOpen} hideActions onClose={()=>setConfirmOpen(false)} title="Confirm & Pay">
        <p>Proceed to pay {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(discountedTotal)}? Your address will be used for shipping.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={()=>setConfirmOpen(false)} className="px-4 py-2">Cancel</button>
          <button onClick={startPayment} className="px-4 py-2 btn btn-primary">Yes, Pay</button>
        </div>
      </Modal>
    </div>
  );
}
