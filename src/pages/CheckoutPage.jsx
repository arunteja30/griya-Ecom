import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { createOrder as createOrderInDb } from '../firebaseApi';
import { showToast } from '../components/Toast';
import { useFirebaseObject } from '../hooks/useFirebase';
import { createOrderOnServer, openRazorpayCheckout } from '../utils/razorpay';

export default function CheckoutPage() {
  const { cartItems = [], cartTotal = 0, clearCart } = useCart() || {};
  const navigate = useNavigate();

  const [address, setAddress] = useState({ name: '', phone: '', line1: '', city: '', pincode: '' });
  const [loading, setLoading] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [error, setError] = useState(null);

  const MIN_ORDER = 350; // minimum order amount in INR

  const { data: siteSettings } = useFirebaseObject('/siteSettings');

  useEffect(() => {
    // If cart becomes empty while on this page, redirect to /cart
    if (!cartItems || cartItems.length === 0) {
      // do not navigate away immediately if an order was just placed
      if (!placedOrder) navigate('/cart');
    }
  }, [cartItems, navigate, placedOrder]);

  const validate = () => {
    if (!address.name.trim()) return 'Please enter full name';
    if (!/^[0-9]{6,15}$/.test(address.phone.replace(/\D/g, ''))) return 'Please enter a valid phone number';
    if (!address.line1.trim()) return 'Please enter address line';
    if (!address.city.trim()) return 'Please enter city';
    if (!/^[0-9]{5,6}$/.test(address.pincode)) return 'Please enter a valid pincode';
    if (!cartItems || cartItems.length === 0) return 'Your cart is empty';
    if ((cartTotal || 0) < MIN_ORDER) return `Minimum order value is ₹${MIN_ORDER}`;
    return null;
  };

  const placeOrder = async () => {
    const v = validate();
    if (v) return setError(v);
    setError(null);
    setLoading(true);

    // Build simple order object (will be saved after successful payment)
    const order = {
      id: `order_${Date.now()}`,
      items: cartItems.map((it) => ({ id: it.id, name: it.product?.name || it.name || 'Item', price: it.product?.price || it.price || 0, quantity: it.quantity || 1 })),
      total: cartTotal,
      address: { ...address },
      createdAt: new Date().toISOString(),
    };

    try {
      // Create an order on server to obtain Razorpay order id (paise)
      const amountPaise = Math.round((cartTotal || 0) * 100);
      const serverResp = await createOrderOnServer(amountPaise);

      const orderId = serverResp?.order_id || serverResp?.id || serverResp?.razorpay_order_id || serverResp?.orderId;
      const rkey = siteSettings?.razorpayKey || import.meta.env.VITE_RAZORPAY_KEY || serverResp?.key || serverResp?.key_id;

      if (!rkey) {
        console.warn('Razorpay key not found; falling back to saving order without payment');
        try {
          await createOrderInDb(order);
        } catch (dbErr) {
          console.warn('Failed to save order to Firebase:', dbErr);
          showToast('Order placed but saving to database failed', 'warning');
        }
        clearCart();
        setPlacedOrder(order);
        showToast('Order placed (no payment)');
        setLoading(false);
        return;
      }

      // Open Razorpay modal
      await openRazorpayCheckout({
        key: rkey,
        amountINR: cartTotal,
        name: siteSettings?.brandName || 'Store',
        description: 'Order Payment',
        prefill: { name: address.name, contact: address.phone },
        orderId,
        onSuccess: async (resp) => {
          // resp contains razorpay_payment_id, razorpay_order_id, razorpay_signature
          const paymentInfo = {
            razorpayPaymentId: resp?.razorpay_payment_id || resp?.payment_id,
            razorpayOrderId: resp?.razorpay_order_id || resp?.order_id,
            razorpaySignature: resp?.razorpay_signature || resp?.signature
          };

          const finalOrder = { ...order, payment: paymentInfo };

          try {
            await createOrderInDb(finalOrder);
          } catch (dbErr) {
            console.warn('Failed to save order to Firebase:', dbErr);
            showToast('Payment succeeded but saving order failed', 'warning');
          }

          clearCart();
          setPlacedOrder(finalOrder);
          showToast('Payment successful, order placed', 'success');
          setLoading(false);
        },
        onFailure: (err) => {
          console.error('Payment failed', err);
          setError('Payment failed or cancelled');
          showToast('Payment failed or cancelled', 'error');
          setLoading(false);
        }
      });

    } catch (err) {
      console.error('Failed to place order / start payment:', err);
      setError('Failed to start payment');
      setLoading(false);
    }
  };

  // Build WhatsApp message and open chat
  const openWhatsApp = () => {
    const whatsappNumber = String(siteSettings?.whatsapp || siteSettings?.whatapp || siteSettings?.phone || '');
    const cleaned = whatsappNumber.replace(/[^0-9+]/g, '');
    if (!cleaned) {
      showToast('WhatsApp number not configured', 'error');
      return;
    }

    const lines = [];
    lines.push(`Hello${siteSettings?.siteName ? ' from ' + siteSettings.siteName : ''}, I would like to place an order:`);
    lines.push('');
    lines.push('Order details:');
    cartItems.forEach((item, idx) => {
      const p = item.product || item;
      lines.push(`${idx + 1}. ${p.name} x ${item.quantity} - ₹${p.price || p.product?.price || 0}`);
    });
    lines.push('');
    lines.push(`Total: ₹${cartTotal}`);
    if (address.name || address.line1) {
      lines.push('');
      lines.push('Shipping to:');
      lines.push(`${address.name || ''}`);
      lines.push(`${address.line1 || ''}, ${address.city || ''} - ${address.pincode || ''}`);
      lines.push(`Phone: ${address.phone || ''}`);
    }

    const msg = encodeURIComponent(lines.join('\n'));
    const url = `https://wa.me/${cleaned.replace(/^\+/, '')}?text=${msg}`;
    window.open(url, '_blank');
  };

  if (placedOrder) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <h1 className="text-2xl font-semibold mb-4">Order placed successfully</h1>
        <div className="card p-6">
          <p className="mb-4">Thanks, {placedOrder.address.name}! Your order has been placed.</p>
          <div className="mb-3">
            <div className="text-sm text-neutral-600">Order ID</div>
            <div className="font-mono mt-1">{placedOrder.id}</div>
          </div>

          <div className="mb-3">
            <div className="text-sm text-neutral-600">Total</div>
            <div className="font-semibold">₹{placedOrder.total}</div>
          </div>

          <div className="mb-4">
            <div className="text-sm text-neutral-600">Shipping to</div>
            <div>{placedOrder.address.line1}, {placedOrder.address.city} - {placedOrder.address.pincode}</div>
            <div className="text-sm text-neutral-600">Phone: {placedOrder.address.phone}</div>
          </div>

          <div className="flex gap-3">
            <Link to="/" className="btn btn-primary">Back to Home</Link>
            <button onClick={() => navigate('/collections')} className="btn btn-ghost">Browse Collections</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-semibold mb-4">Checkout</h1>

      <div className="card p-6">
        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="form-label">Full name</label>
            <input className="form-input" value={address.name} onChange={(e)=>setAddress({...address, name: e.target.value})} />
          </div>

          <div>
            <label className="form-label">Phone</label>
            <input className="form-input" value={address.phone} onChange={(e)=>setAddress({...address, phone: e.target.value.replace(/\D/g, '').slice(0,15)})} inputMode="numeric" />
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
              <label className="form-label">Pincode</label>
              <input className="form-input" value={address.pincode} onChange={(e)=>setAddress({...address, pincode: e.target.value.replace(/\D/g, '').slice(0,6)})} inputMode="numeric" />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div>
            <div className="text-lg">Total: ₹{cartTotal}</div>
            { (cartTotal || 0) < MIN_ORDER && (
              <div className="text-sm text-red-600">Minimum order amount is ₹{MIN_ORDER}. Add more items to proceed.</div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link to="/cart" className="btn btn-ghost">Back to Cart</Link>
            <button onClick={placeOrder} disabled={loading || !(cartItems && cartItems.length > 0) || (cartTotal || 0) < MIN_ORDER} className="btn btn-accent">{loading ? 'Placing...' : 'Place Order'}</button>

          </div>
        </div>
      </div>
    </div>
  );
}
