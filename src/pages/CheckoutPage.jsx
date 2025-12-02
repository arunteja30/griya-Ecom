import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import { CartContext } from '../context/CartContext';
import { showToast } from '../components/Toast';
import { useFirebaseList, useFirebaseObject } from '../hooks/useFirebase';
import { createOrder as createOrderInDb } from '../firebaseApi';
import { createOrderOnServer, openRazorpayCheckout, loadRazorpayScript } from '../utils/razorpay';

export default function CheckoutPage() {
  const { cartItems, cartTotal, clearCart, appliedPromo: cartAppliedPromo, appliedPromoKey: cartAppliedPromoKey } = useContext(CartContext);
  const navigate = useNavigate();
  // placedOrder must be declared before effects that reference it
  const [placedOrder, setPlacedOrder] = useState(null);
  
  // Redirect back to cart if there are no items
  useEffect(() => {
    // If cart is empty and no placedOrder exists, redirect back to cart
    if ((!cartItems || cartItems.length === 0) && !placedOrder) {
      navigate('/cart');
    }
  }, [cartItems, navigate, placedOrder]);
  const [address, setAddress] = useState({ name: '', email: '', phone: '', line1: '', city: '', state: '', pincode: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [paymentFailed, setPaymentFailed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromoKey, setAppliedPromoKey] = useState(null);
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState(null);
  const [error, setError] = useState(null);
  const [showProforma, setShowProforma] = useState(false);

  // Reusable class strings to avoid repeating long className literals
  const CLS = {
    label: 'block text-sm font-medium text-gray-700 mb-2',
    input: 'w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent',
    select: 'w-full px-4 py-3 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent',
    card: 'bg-white rounded-xl p-6 shadow-sm border border-gray-100',
    summaryCard: 'bg-white rounded-xl p-6 shadow-sm border border-gray-100 sticky top-6',
    btnPrimary: 'w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors',
    btnWhatsApp: 'w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
    promoInput: 'form-input md:col-span-2'
  };

  const indianStates = [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'
  ];

  const { data: promoData } = useFirebaseList('/promoCodes');
  const { data: siteSettings } = useFirebaseObject('/siteSettings');

  // Validate form fields and return an error message string, or null if valid
  // Normalize and validate address object. Returns { errors, normalized } where errors is a map of field->message
  const normalizeAndValidateAddress = (addr = address) => {
    const a = {
      ...addr,
      name: String(addr.name || '').trim(),
      email: String(addr.email || '').trim(),
      phone: String(addr.phone || '').trim(),
      line1: String(addr.line1 || '').trim(),
      city: String(addr.city || '').trim(),
      state: String(addr.state || '').trim(),
      pincode: String(addr.pincode || '').trim()
    };

    const errors = {};

    // Name: only letters and spaces, min 5
    if (!/^[A-Za-z ]{5,}$/.test(a.name)) errors.name = 'Name must be at least 5 alphabetic characters';

    // Email: basic check + allowed domains
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) errors.email = 'Enter a valid email address';
    else {
      const allowedDomains = ['gmail.com', 'yahoomail.com', 'hotmail.com', 'outlook.com'];
      const domain = (a.email.split('@')[1] || '').toLowerCase();
      if (!allowedDomains.includes(domain)) errors.email = 'Email must be Gmail/Yahoo/Hotmail/Outlook';
    }

    // Phone: extract digits, strip leading zeros, accept 10 local digits; normalize to +91XXXXXXXXXX
    let digits = a.phone.replace(/\D/g, '').replace(/^0+/, '');
    if (digits.startsWith('91') && digits.length > 2) digits = digits.slice(2);
    if (!/^\d{10}$/.test(digits)) errors.phone = 'Phone number must contain exactly 10 digits';
    else a.phone = '+91' + digits;

    // City: alphabets and spaces only
    if (!/^[A-Za-z ]+$/.test(a.city)) errors.city = 'City must contain only letters';

    // Address required
    if (!a.line1) errors.line1 = 'Address is required';

    // Pincode: exactly 6 digits
    if (!/^\d{6}$/.test(a.pincode)) errors.pincode = 'Pincode must be exactly 6 digits';

    return { errors, normalized: a };
  };

  const isValid = () => {
    const { errors } = normalizeAndValidateAddress();
    return Object.keys(errors || {}).length === 0;
  };

  const proceedToPay = async () => {
    const { errors, normalized } = normalizeAndValidateAddress();
    if (errors && Object.keys(errors).length) {
      setFieldErrors(errors);
      // show first error as toast as well
      const first = errors[Object.keys(errors)[0]];
      showToast(first, 'error');
      return;
    }
    if (siteSettings?.enableRazorpayCheckout === false) { showToast('Online payments are disabled', 'error'); return; }
    // Persist normalized address to state (so UI reflects it) but pass it into startPayment immediately
    setFieldErrors({});
    setAddress(normalized);
    try {
      await startPayment(normalized);
    } catch (e) {
      console.error('proceedToPay error', e);
      showToast('Unable to start payment', 'error');
      setLoading(false);
    }
  };
  
  const computeDiscount = (total, promo) => {
    if (!promo) return 0;
    const amount = Number(promo.amount) || 0;
    if (promo.type === 'percent') return Math.round((total * amount) / 100);
    return Math.round(amount);
  };

  // Helper to compute items subtotal from order/cart items
  const computeItemsTotal = (items) => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, it) => sum + (Number(it?.price || 0) * (Number(it?.quantity) || 1)), 0);
  };

  const discountedAmount = computeDiscount(cartTotal, appliedPromo);
  const discountedTotal = Math.max(0, cartTotal - discountedAmount);
  // Delivery & free-shipping calculations
  const freeShippingEnabled = siteSettings?.freeShippingEnabled !== false;
  const freeShippingThreshold = Number(siteSettings?.freeShippingThreshold || 0);
  const qualifiesFreeShipping = freeShippingEnabled && freeShippingThreshold > 0 && discountedTotal >= freeShippingThreshold;
  const deliveryEnabled = siteSettings?.deliveryEnabled !== false;
  const deliveryChargeAmount = Number(siteSettings?.deliveryChargeAmount || 0);
  const deliveryCharge = deliveryEnabled ? (qualifiesFreeShipping ? 0 : deliveryChargeAmount) : 0;
  const finalTotal = Math.max(0, discountedTotal + deliveryCharge);
  // Feature flags (support multiple possible siteSettings keys for compatibility)
  const whatsappEnabled = (siteSettings?.enableWhatsAppCheckout === true);
  const proceedEnabled = siteSettings?.enableRazorpayCheckout !== false;

  // Normalize cart items for order payloads: cartItems items may be stored as { id, product, quantity }
  const normalizeCartItems = (items) => (Array.isArray(items) ? items.map((it) => {
    const product = it?.product || it || {};
    return {
      id: it?.id ?? product?.id ?? null,
      // prefer explicit item description, then product description or common fields
      description: it?.description ?? product?.description ?? product?.shortDescription ?? '',
      name: (it?.name ?? (product?.name || product?.title || product?.label || 'Item')),
      price: Number(it?.price ?? product?.price ?? product?.mrp ?? 0) || 0,
      quantity: Number(it?.quantity) || 1,
      image: (it?.image ?? (product?.image || (Array.isArray(product?.images) ? product.images[0] : '') || ''))
    };
  }) : []);

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
    if (max > 0 && used >= max) return setPromoError('Promo code has expired');

    setAppliedPromoKey(foundKey);
    setAppliedPromo(found);
    showToast('Promo applied', 'success');
  };

  const startPayment = async (addressOverride) => {
    setConfirmOpen(false);
    setLoading(true);
    try {
      await loadRazorpayScript();

      // Compute amount in paise using finalTotal (includes promo & delivery)
      const amountPaise = Math.round((finalTotal || 0) * 100);
      const serverResp = await createOrderOnServer(amountPaise);

      // Normalize server response for order id
      const orderId = serverResp?.order_id || serverResp?.id || serverResp?.razorpay_order_id || serverResp?.orderId || serverResp?.data?.id || null;

      // Prefer site-configured key, then env, then server returned key
      const rkey = siteSettings?.razorpayKey || import.meta.env.VITE_RAZORPAY_KEY || serverResp?.key || serverResp?.key_id || null;

      // If no Razorpay key available, fallback to saving an offline/pending order
      if (!rkey) {
        setLoading(false);
        showToast('Payment gateway not configured — saving order as pending', 'warning');
        const offlineOrder = {
          orderId: orderId || `offline_${Date.now()}`,
          amount: finalTotal,
          currency: 'INR',
          status: 'pending',
          createdAt: new Date().toISOString(),
          promo: appliedPromo ? { key: appliedPromoKey, code: appliedPromo.code, discount: discountedAmount } : null,
          delivery: { charge: deliveryCharge },
          customer: { name: address.name, email: address.email, phone: address.phone },
          shipping: { line1: address.line1, city: address.city, state: address.state, pincode: address.pincode },
          items: normalizeCartItems(cartItems)
        };
        const safeOffline = JSON.parse(JSON.stringify(offlineOrder, (_k, v) => (v === undefined ? null : v)));
        try {
          await createOrderInDb(safeOffline);
        } catch (dbErr) {
          console.warn('Failed to save offline order to Firebase:', dbErr);
          showToast('Order saved locally but failed to persist to database', 'warning');
        }
        clearCart();
        setPlacedOrder(offlineOrder);
        return;
      }

      const addr = addressOverride || address;
      const shippingText = `${addr.name}, ${addr.line1}, ${addr.city}, ${addr.state} - ${addr.pincode}`;

      // Helper: decrement stock for ordered items using Firebase transactions
      const decrementProductStocks = async (items) => {
        if (!Array.isArray(items) || items.length === 0) return;
        try {
          const { ref, runTransaction } = await import('firebase/database');
          const { db } = await import('../firebase');
          for (const it of items) {
            const pid = it?.id || it?.product?.id || null;
            const qty = Number(it?.quantity || it?.qty || 1);
            if (!pid || qty <= 0) continue;
            const prodRef = ref(db, `/products/${pid}`);
            try {
              await runTransaction(prodRef, (prod) => {
                if (!prod) return prod; // nothing to do
                const currentStock = Number(prod.stock || prod.quantity || 0);
                const newStock = Math.max(0, currentStock - qty);
                prod.stock = newStock;
                prod.inStock = newStock > 0;
                return prod;
              });
            } catch (txErr) {
              console.warn('Failed to decrement stock for', pid, txErr);
            }
          }
        } catch (e) {
          console.warn('decrementProductStocks failed', e);
        }
      };

      openRazorpayCheckout({
        key: rkey,
        amountINR: finalTotal,
        orderId,
        name: siteSettings?.brandName || 'Griya Jewellery',
        description: `Order Payment. Ship to: ${shippingText}`,
        prefill: { name: addr.name, email: addr.email, contact: addr.phone },
        onSuccess: async (resp) => {
          // Handle payment success similar to test.jsx: save order with payment info and clear cart
          try {
            const paymentInfo = {
              razorpayPaymentId: resp?.razorpay_payment_id ?? resp?.payment_id ?? null,
              razorpayOrderId: resp?.razorpay_order_id ?? resp?.order_id ?? null,
              razorpaySignature: resp?.razorpay_signature ?? resp?.signature ?? null
            };

            const orderData = {
              orderId: paymentInfo.razorpayOrderId || orderId || `order_${Date.now()}`,
              payment: paymentInfo,
              amount: finalTotal,
              currency: 'INR',
              status: 'paid',
              createdAt: new Date().toISOString(),
              promo: appliedPromo ? { key: appliedPromoKey, code: appliedPromo.code, discount: discountedAmount } : null,
              delivery: { charge: deliveryCharge },
              customer: { name: addr.name, email: addr.email, phone: addr.phone },
              shipping: { line1: addr.line1, city: addr.city, state: addr.state, pincode: addr.pincode },
              items: normalizeCartItems(cartItems)
            };

            const safeOrder = JSON.parse(JSON.stringify(orderData, (_k, v) => (v === undefined ? null : v)));
            try {
              await createOrderInDb(safeOrder);
            } catch (dbErr) {
              console.warn('Failed to save order to Firebase:', dbErr);
              showToast('Payment succeeded but saving order failed', 'warning');
            }

            clearCart();
            setPlacedOrder(orderData);
             setLoading(false);
             showToast('Payment successful, order placed', 'success');
          } catch (e) {
            console.error('onSuccess handler error', e);
            setLoading(false);
            showToast('Payment succeeded but an error occurred', 'warning');
          }
        },
        onFailure: async (failureResp) => {
          // Handle payment failure: record failure and show a dedicated screen
          try {
            console.error('Payment failed', failureResp);
            setError('Payment failed or cancelled');
            setPaymentFailed({ message: 'Payment failed or cancelled', details: failureResp });
            showToast('Payment failed or cancelled', 'error');
            setLoading(false);
            closePaymentModal();
          } catch (e) {
            console.error('onFailure handler error', e);
            setLoading(false);
            setPaymentFailed({ message: 'Payment failed', details: e });
            showToast('Payment failed', 'error');
          }
        }
      });
    } catch (err) {
      setLoading(false);
      showToast('Payment could not be started: ' + err.message, 'error');
    }
  };

  // Send order summary via WhatsApp (includes image URLs)
  const sendWhatsappOrder = () => {
    const { errors, normalized } = normalizeAndValidateAddress();
    if (errors && Object.keys(errors).length) {
      setFieldErrors(errors);
      const first = errors[Object.keys(errors)[0]];
      showToast(first, 'error');
      return;
    }
    // ensure we use normalized address for message
    setFieldErrors({});
    setAddress(normalized);
    try {
      const items = normalizeCartItems(cartItems || []);
      const lines = [];
      lines.push(`${siteSettings?.brandName || 'Griya Jewellery'} - Order Request`);
      lines.push('Hi there, I am interested in placing an order.');
      lines.push(`Order ID: ${''}`);
      lines.push(`Name: ${normalized.name || ''}`);
      lines.push(`Phone: ${normalized.phone || ''}`);
      if (normalized.line1) lines.push(`Address: ${normalized.line1}, ${normalized.city || ''} ${normalized.state || ''}- ${normalized.pincode || ''}`);
      lines.push('');
      lines.push('Items:');
      items.forEach((it) => {
        lines.push(`- ${it.name} x${it.quantity} @ ₹${it.price} = ₹${(Number(it.price || 0) * Number(it.quantity || 1))}`);
        if (it.image) lines.push(`  Image: ${it.image}`);
      });
      lines.push('');
      lines.push(`Subtotal: ₹${computeItemsTotal(items)}`);
      if (appliedPromo) lines.push(`Discount (${appliedPromo.code}): -₹${discountedAmount}`);
      if (deliveryCharge) lines.push(`Delivery: ₹${deliveryCharge}`);
      lines.push(`Total: ₹${finalTotal}`);

      const text = encodeURIComponent(lines.join('\n'));
      // Prefer configured WhatsApp number (support multiple keys), normalize digits
      const rawPhone = siteSettings?.whatsappNumber || siteSettings?.whatsapp || siteSettings?.contactPhone || '';
      let phoneDigits = String(rawPhone || '').replace(/\D/g, '');
      // remove leading zeros
      phoneDigits = phoneDigits.replace(/^0+/, '');
      // if 10 digits (likely India), prefix country code 91
      if (phoneDigits.length === 10) phoneDigits = '91' + phoneDigits;
      const url = phoneDigits ? `https://wa.me/${phoneDigits}?text=${text}` : `https://wa.me/?text=${text}`;
      window.open(url, '_blank');
    } catch (e) {
      console.error('WhatsApp share failed', e);
      showToast('Unable to open WhatsApp', 'error');
    }
  };

  // If the cart already had a promo applied, carry it into the checkout page state
  useEffect(() => {
    try {
      if (cartAppliedPromo) {
        setAppliedPromo(cartAppliedPromo);
        setAppliedPromoKey(cartAppliedPromoKey ?? null);
        setPromoInput(cartAppliedPromo?.code || '');
      }
    } catch (e) {
      // non-fatal
    }
  }, [cartAppliedPromo, cartAppliedPromoKey]);

  // Render logic: use explicit branches to avoid nested ternary JSX and parentheses issues
  if (paymentFailed) {
    const orderIdDisplay = (placedOrder?. _id) || (placedOrder?.orderId) || paymentFailed?.orderId || '—';
    const statusDisplay = placedOrder?.status || paymentFailed?.message || 'failed';
    const shipping = placedOrder?.shipping || {};
    const contactPhone = placedOrder?.customer?.phone || address?.phone || '—';
    const items = Array.isArray(placedOrder?.items) ? placedOrder.items : [];

    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="mb-4">
          <button onClick={() => { setPaymentFailed(null); navigate('/cart'); }} className="text-sm text-gray-500 hover:text-gray-700 no-print flex items-center gap-2">
            <span aria-hidden>←</span>
            <span>Back to cart</span>
          </button>
        </div>

        <div className="text-center mb-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Payment Failed</h1>
          <p className="text-lg font-semibold text-red-700">{paymentFailed?.message || 'Payment failed. Please try again.'}</p>
          <p className="text-sm text-neutral-500 mt-2">If this continues, try another payment method or contact support.</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 max-w-2xl mx-auto">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Status</span>
              <span className="text-xl font-bold text-red-600">{statusDisplay}</span>
            </div>
            <div className="pt-4 border-t">
              <div className="text-sm text-gray-600 mb-2">Delivery / Contact</div>
              <div className="text-gray-800">
                {shipping.line1 && <div>{shipping.line1}</div>}
                {shipping.city || shipping.pincode ? <div>{shipping.city} - {shipping.pincode}</div> : null}
                <div className="text-sm text-gray-600 mt-1">📞 {contactPhone}</div>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6 pt-6 border-t">
            <button onClick={async () => { setPaymentFailed(null); setFieldErrors({}); try { await proceedToPay(); } catch (e) {} }} className="flex-1 btn btn-primary">Retry Payment</button>
            <button onClick={() => { setPaymentFailed(null); navigate('/cart'); }} className="flex-1 border border-gray-300 text-gray-700 py-3 rounded">Back to Cart</button>
          </div>
        </div>
      </div>
    );
  }

  if (placedOrder) {
    // Paid / confirmed
    if (placedOrder.status === 'paid') {
      return (
        <div className="max-w-3xl mx-auto py-8">
          <div className="mb-4">
            <button onClick={() => navigate('/cart')} className="text-sm text-gray-500 hover:text-gray-700 no-print flex items-center gap-2">
              <span aria-hidden>←</span>
              <span>Back to cart</span>
            </button>
          </div>
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Order Confirmed</h1>
            <p className="text-gray-600">Thank you {placedOrder.customer?.name || 'Customer'}. Your order has been placed.</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 max-w-2xl mx-auto">
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-gray-600">Order ID</span>
                <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded">{placedOrder._id || placedOrder.orderId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Amount</span>
                <span className="text-xl font-bold text-gray-800">₹{placedOrder.amount}</span>
              </div>

              <div className="pt-4 border-t">
                <div className="text-sm text-gray-600 mb-2">Delivery Address</div>
                <div className="text-gray-800">
                  <div className="font-medium">{placedOrder.shipping?.line1 ? placedOrder.customer?.name : ''}</div>
                  <div>{placedOrder.shipping?.line1}</div>
                  <div>{placedOrder.shipping?.city} - {placedOrder.shipping?.pincode}</div>
                  <div className="text-sm text-gray-600 mt-1">📞 {placedOrder.customer?.phone}</div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="text-sm text-gray-600 mb-2">Items</div>
                <div className="divide-y divide-gray-100">
                  {(Array.isArray(placedOrder.items) ? placedOrder.items : []).map((it, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-800">{it?.name || 'Item'}</div>
                        {it?.description && <div className="text-xs text-gray-500">Description: {it.description}</div>}
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Qty: {it?.quantity ?? 1}</div>
                        <div className="font-semibold">₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format((Number(it?.price || 0) * (it?.quantity || 1)))}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Printable proforma invoice (rendered only when printing is requested) */}
                {showProforma && (
                  <div className="print-proforma mt-6">
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <h1 className="text-xl font-bold">{siteSettings?.name || 'Griya Jewellery'}</h1>
                        <h2 className="text-xl font-bold">Order Invoice</h2>
                        <div className="text-sm text-gray-600"></div>
                      </div>
                      <div className="text-sm text-right">
                        <div>Order: {placedOrder._id || placedOrder.orderId}</div>
                        <div>{new Date(placedOrder.createdAt || Date.now()).toLocaleString()}</div>
                        <div>Status: {String(placedOrder.status || 'Pending')}</div>
                      </div>
                    </div>

                    <div className="mb-4 text-sm">
                      <div className="font-semibold">Bill To:</div>
                      <div>{placedOrder.customer?.name}</div>
                      {placedOrder.customer?.email && <div>{placedOrder.customer.email}</div>}
                      <div>📞 {placedOrder.customer?.phone}</div>
                      <div className="mt-2">{placedOrder.shipping?.line1}</div>
                      <div>{placedOrder.shipping?.city} - {placedOrder.shipping?.pincode}</div>
                      <div>{placedOrder.shipping?.state}</div>
                    </div>

                    <table className="w-full text-sm border-collapse mb-4">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Item</th>
                          <th className="text-left py-2">Qty</th>
                          <th className="text-right py-2">Rate</th>
                          <th className="text-right py-2">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(placedOrder.items) ? placedOrder.items : []).map((it, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="py-2">{it?.name}</td>
                            <td className="py-2">{it?.quantity ?? 1}</td>
                            <td className="py-2 text-right">₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(it?.price || 0))}</td>
                            <td className="py-2 text-right">₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format((Number(it?.price || 0) * (it?.quantity || 1)))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="flex justify-end text-sm">
                      <div className="w-64">
                        <div className="flex justify-between py-1"><span>Subtotal</span><span>₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(computeItemsTotal(placedOrder.items))}</span></div>
                        {placedOrder.promo && (
                          <div className="flex justify-between py-1"><span>Discount</span><span>- ₹{placedOrder.promo?.discount ?? 0}</span></div>
                        )}
                        {placedOrder.delivery && (
                          <div className="flex justify-between py-1"><span>Delivery</span><span>₹{placedOrder.delivery?.charge ?? 0}</span></div>
                        )}
                        <div className="border-t pt-2 flex justify-between font-semibold"><span>Total</span><span>₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(placedOrder.amount ?? (computeItemsTotal(placedOrder.items) - (placedOrder.promo?.discount || 0) + (placedOrder.delivery?.charge || 0)) )}</span></div>
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 mt-4">Thank you for your order</div>
                  </div>
                )}

              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t">
                <button onClick={() => { setPlacedOrder(null); navigate('/'); }} className="flex-1 btn btn-accent no-print">Continue Shopping</button>
                <button onClick={() => {
                  try {
                    // Show proforma, then open print dialog. Hide after printing.
                    setShowProforma(true);
                    // Some browsers need a short delay to render the proforma
                    setTimeout(() => {
                      // register afterprint handler to hide proforma
                      const after = () => { setShowProforma(false); try { window.removeEventListener('afterprint', after); } catch(e){} };
                      try { window.addEventListener('afterprint', after); } catch(e) { window.onafterprint = after; }
                      window.print();
                    }, 120);
                  } catch (e) {
                    console.error('Print failed', e);
                    setShowProforma(false);
                  }
                }} className="flex-1 border border-gray-300 hover:border-gray-400 text-gray-700 py-3 text-center rounded-lg font-medium transition-colors no-print">Print Receipt</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Placed but not paid / pending view
    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="mb-4">
          <button onClick={() => navigate('/cart')} className="text-sm text-gray-500 hover:text-gray-700 no-print flex items-center gap-2">
            <span aria-hidden>←</span>
            <span>Back to cart</span>
          </button>
        </div>
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">⏳</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Order Placed</h1>
          <p className="text-gray-600">Thank you {placedOrder.customer?.name || 'Customer'}. Your order has been received.</p>
          <p className="text-gray-600">We are processing your order and will notify you once it's confirmed.</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 max-w-2xl mx-auto">
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b">
              <span className="text-gray-600">Order ID</span>
              <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded">{placedOrder._id || placedOrder.orderId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Amount</span>
              <span className="text-xl font-bold text-gray-800">₹{placedOrder.amount}</span>
            </div>

            <div className="pt-4 border-t">
              <div className="text-sm text-gray-600 mb-2">Delivery Address</div>
              <div className="text-gray-800">
                <div className="font-medium">{placedOrder.shipping?.line1 ? placedOrder.customer?.name : ''}</div>
                <div>{placedOrder.shipping?.line1}</div>
                <div>{placedOrder.shipping?.city} - {placedOrder.shipping?.pincode}</div>
                <div className="text-sm text-gray-600 mt-1">📞 {placedOrder.customer?.phone}</div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="text-sm text-gray-600 mb-2">Items</div>
              <div className="divide-y divide-gray-100">
                {(Array.isArray(placedOrder.items) ? placedOrder.items : []).map((it, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-800">{it?.name || 'Item'}</div>
                      {it?.description && <div className="text-xs text-gray-500">Description: {it.description}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Qty: {it?.quantity ?? 1}</div>
                      <div className="font-semibold">₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format((Number(it?.price || 0) * (it?.quantity || 1)))}</div>
                    </div>
                  </div>
                ))}
              </div>

              {showProforma && (
                <div className="print-proforma mt-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold">Proforma Invoice</h2>
                      <div className="text-sm text-gray-600">{siteSettings?.name || 'Griya Jewellery'}</div>
                    </div>
                    <div className="text-sm text-right">
                      <div>Order: {placedOrder._id || placedOrder.orderId}</div>
                      <div>{new Date(placedOrder.createdAt || Date.now()).toLocaleString()}</div>
                      <div>Status: {String(placedOrder.status || 'Pending')}</div>
                    </div>
                  </div>

                  <div className="mb-4 text-sm">
                    <div className="font-semibold">Bill To:</div>
                    <div>{placedOrder.customer?.name}</div>
                    {placedOrder.customer?.email && <div>{placedOrder.customer.email}</div>}
                    <div>📞 {placedOrder.customer?.phone}</div>
                    <div className="mt-2">{placedOrder.shipping?.line1}</div>
                    <div>{placedOrder.shipping?.city} - {placedOrder.shipping?.pincode}</div>
                  </div>

                  <table className="w-full text-sm border-collapse mb-4">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Item</th>
                        <th className="text-left py-2">Qty</th>
                        <th className="text-right py-2">Rate</th>
                        <th className="text-right py-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(placedOrder.items) ? placedOrder.items : []).map((it, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="py-2">{it?.name}</td>
                          <td className="py-2">{it?.quantity ?? 1}</td>
                          <td className="py-2 text-right">₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(it?.price || 0))}</td>
                          <td className="py-2 text-right">₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format((Number(it?.price || 0) * (it?.quantity || 1)))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-end text-sm">
                    <div className="w-64">
                      <div className="flex justify-between py-1"><span>Subtotal</span><span>₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(computeItemsTotal(placedOrder.items))}</span></div>
                      {placedOrder.promo && (
                        <div className="flex justify-between py-1"><span>Discount</span><span>- ₹{placedOrder.promo?.discount ?? 0}</span></div>
                      )}
                      {placedOrder.delivery && (
                        <div className="flex justify-between py-1"><span>Delivery</span><span>₹{placedOrder.delivery?.charge ?? 0}</span></div>
                      )}
                      <div className="border-t pt-2 flex justify-between font-semibold"><span>Total</span><span>₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(placedOrder.amount ?? (computeItemsTotal(placedOrder.items) - (placedOrder.promo?.discount || 0) + (placedOrder.delivery?.charge || 0)) )}</span></div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 mt-4">Thank you for your order</div>
                </div>
              )}

            </div>

            <div className="flex gap-3 mt-6 pt-6 border-t">
              <button onClick={() => { setPlacedOrder(null); navigate('/'); }} className="flex-1 btn btn-accent no-print">Continue Shopping</button>
              <button onClick={() => {
                try {
                  setShowProforma(true);
                  setTimeout(() => {
                    const after = () => { setShowProforma(false); try { window.removeEventListener('afterprint', after); } catch(e){} };
                    try { window.addEventListener('afterprint', after); } catch(e) { window.onafterprint = after; }
                    window.print();
                  }, 120);
                } catch (e) { console.error('Print failed', e); setShowProforma(false); }
              }} className="flex-1 border border-gray-300 hover:border-gray-400 text-gray-700 py-3 text-center rounded-lg font-medium transition-colors no-print">Print Receipt</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default checkout form
  return (
    <div className="max-w-3xl mx-auto py-8 flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
      <div className="mb-4 sticky top-0 z-30 py-3 md:hidden">
        <div className="flex items-center">
          <button onClick={() => navigate('/cart')} className="p-2 rounded-full bg-primary-600 text-white shadow-md inline-flex items-center justify-center no-print hidden md:block" aria-label="Back to cart">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Desktop / tablet: full hero (title + description) */}
      <div className="mb-6 sticky top-0 z-30 py-3 hidden md:block">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/cart')} className="p-2 rounded-full bg-primary-600 text-white shadow-md inline-flex items-center justify-center no-print">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-0">Checkout</h1>
            <p className="text-gray-600 text-sm">Complete your purchase by providing the details below.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 max-w-2xl mx-auto flex-1 overflow-auto min-h-0">
        <div className="space-y-4">
          {/* Address form */}
          <div>
            <div className={CLS.label}>Name</div>
            <input
              type="text"
              value={address.name}
              onChange={(e) => {
                // allow only alphabets and spaces
                const val = (e.target.value || '').replace(/[^A-Za-z ]/g, '');
                setAddress(prev => ({ ...prev, name: val }));
                setFieldErrors(prev => { const copy = { ...prev }; delete copy.name; return copy; });
              }}
              className={CLS.input}
              placeholder="Full Name"
            />
            {fieldErrors.name && <div className="text-red-500 text-sm mt-1">{fieldErrors.name}</div>}
          </div>
          <div>
            <div className={CLS.label}>Email</div>
            <input type="email" value={address.email} onChange={(e) => setAddress({ ...address, email: e.target.value })} className={CLS.input} placeholder="Email Address" />
            {fieldErrors.email && <div className="text-red-500 text-sm mt-1">{fieldErrors.email}</div>}
          </div>
          <div>
            <div className={CLS.label}>Phone</div>
            <input
              type="tel"
              value={address.phone}
              onChange={(e) => {
                // allow only digits and limit to 10 numbers
                const digits = (e.target.value || '').replace(/\D/g, '').slice(0, 10);
                setAddress(prev => ({ ...prev, phone: digits }));
                setFieldErrors(prev => { const copy = { ...prev }; delete copy.phone; return copy; });
              }}
              className={CLS.input}
              placeholder="10-digit phone"
            />
            {fieldErrors.phone && <div className="text-red-500 text-sm mt-1">{fieldErrors.phone}</div>}
          </div>
          <div>
            <div className={CLS.label}>Address</div>
            <input type="text" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} className={CLS.input} placeholder="Street Address, P.O. Box, etc." />
            {fieldErrors.line1 && <div className="text-red-500 text-sm mt-1">{fieldErrors.line1}</div>}
          </div>
          <div>
            <div className={CLS.label}>City</div>
            <input type="text" value={address.city} onChange={(e) => { const val = (e.target.value||'').replace(/[^A-Za-z ]/g,''); setAddress({ ...address, city: val }); setFieldErrors(prev => { const copy = { ...prev }; delete copy.city; return copy; }); }} className={CLS.input} placeholder="City" />
            {fieldErrors.city && <div className="text-red-500 text-sm mt-1">{fieldErrors.city}</div>}
          </div>
          <div>
            <div className={CLS.label}>State</div>
            <select value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} className={CLS.select}>
              <option value="">Select State</option>
              {indianStates.map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
          <div>
            <div className={CLS.label}>Pincode</div>
            <input type="text" value={address.pincode} onChange={(e) => { const digits = (e.target.value || '').replace(/\D/g, '').slice(0,6); setAddress({ ...address, pincode: digits }); setFieldErrors(prev => { const copy = { ...prev }; delete copy.pincode; return copy; }); }} className={CLS.input} placeholder="6-digit Pincode" />
            {fieldErrors.pincode && <div className="text-red-500 text-sm mt-1">{fieldErrors.pincode}</div>}
          </div>

          {/* Promo code input */}
          <div>
            <div className={CLS.label}>Promo Code</div>
            <div className="flex gap-2">
              <input type="text" value={promoInput} onChange={(e) => setPromoInput(e.target.value)} className={`${CLS.input} ${CLS.promoInput}`} placeholder="Enter promo code" />
              <button onClick={applyPromo} className="btn btn-primary w-full">Apply</button>
            </div>
            {promoError && <div className="text-red-500 text-sm mt-1">{promoError}</div>}
          </div>

          {/* Order summary */}
          <div className={CLS.summaryCard}>
            <div className="font-semibold text-lg mb-4">Order Summary</div>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <div>Subtotal</div>
              <div>₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(cartTotal)}</div>
            </div>
            {appliedPromo && (
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <div>Discount ({appliedPromo.code})</div>
                <div className="text-red-500">- ₹{discountedAmount}</div>
              </div>
            )}
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <div>Delivery</div>
              <div>₹{deliveryCharge}</div>
            </div>
            <div className="border-t border-gray-200 pt-2 mt-2">
              <div className="flex justify-between font-semibold text-lg">
                <div>Total</div>
                <div>₹{finalTotal}</div>
              </div>
            </div>
          </div>

          {/* Payment buttons: WhatsApp order + Proceed to Payment (visibility controlled by siteSettings) */}
          <div className={`grid gap-3 ${whatsappEnabled && proceedEnabled ? 'sm:grid-cols-2' : ''}`}>
            {whatsappEnabled && (
              <button onClick={sendWhatsappOrder} className={CLS.btnWhatsApp} disabled={!cartItems || cartItems.length === 0}>
                Place WhatsApp Order
              </button>
            )}

            {proceedEnabled && (
              <button onClick={proceedToPay} className="btn btn-primary w-full" disabled={loading}>
                {loading ? 'Processing...' : 'Proceed to Payment'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
