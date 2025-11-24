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

  // fees fetched from site settings (flat INR amounts). Defaults to 0
  const platformFee = Number(siteSettings?.platformFee || 0);
  const surgeFee = Number(siteSettings?.surgeFee || 0);
  const otherFee = Number(siteSettings?.otherFee || 0);
  const deliveryFee = Number(siteSettings?.deliveryFee || 0);
  const freeDeliveryMin = Number(siteSettings?.freeDeliveryMin || 0);
  // if subtotal meets freeDeliveryMin, delivery is free
  const deliveryFeeApplied = freeDeliveryMin > 0 && (cartTotal || 0) >= freeDeliveryMin ? 0 : deliveryFee;
  const feesTotal = platformFee + surgeFee + otherFee + deliveryFeeApplied; // recalc with applied delivery
  const totalWithFees = (cartTotal || 0) + feesTotal;

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
      subtotal: cartTotal,
      fees: { platformFee, surgeFee, otherFee, deliveryFee, deliveryFeeApplied, feesTotal },
      total: totalWithFees,
      address: { ...address },
      createdAt: new Date().toISOString(),
    };

    try {
      // Create an order on server to obtain Razorpay order id (paise)
      const amountPaise = Math.round((totalWithFees || 0) * 100);
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
    if(platformFee) lines.push(`Platform fee: ₹${platformFee}`);
    if(surgeFee) lines.push(`Surge fee: ₹${surgeFee}`);
    if(otherFee) lines.push(`Other fee: ₹${otherFee}`);
    if(deliveryFeeApplied) lines.push(`Delivery fee: ₹${deliveryFeeApplied}`);
    else if(freeDeliveryMin > 0) lines.push(`Delivery: Free (orders ≥ ₹${freeDeliveryMin})`);
    lines.push(`Total: ₹${totalWithFees}`);
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Order Placed Successfully!</h1>
          <p className="text-gray-600">Thank you {placedOrder.address.name}, your order is confirmed</p>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 max-w-2xl mx-auto">
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b">
              <span className="text-gray-600">Order ID</span>
              <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded">{placedOrder.id}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Amount</span>
              <span className="text-xl font-bold text-gray-800">₹{placedOrder.total}</span>
            </div>

            <div className="pt-4 border-t">
              <div className="text-sm text-gray-600 mb-2">Delivery Address</div>
              <div className="text-gray-800">
                <div className="font-medium">{placedOrder.address.name}</div>
                <div>{placedOrder.address.line1}</div>
                <div>{placedOrder.address.city} - {placedOrder.address.pincode}</div>
                <div className="text-sm text-gray-600 mt-1">📞 {placedOrder.address.phone}</div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-6 border-t">
            <Link to="/" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 text-center rounded-lg font-medium transition-colors">
              Continue Shopping
            </Link>
            <Link to="/groceries" className="flex-1 border border-gray-300 hover:border-gray-400 text-gray-700 py-3 text-center rounded-lg font-medium transition-colors">
              Browse More
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Delivery Information */}
        <div className="lg:col-span-2">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Checkout</h1>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input 
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" 
                  value={address.name} 
                  onChange={(e) => setAddress({...address, name: e.target.value})}
                  placeholder="Enter your full name"
                />
                {error && error.toLowerCase().includes('name') && (
                  <div className="mt-2 text-sm text-red-600">
                    {error}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <input 
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" 
                  value={address.phone} 
                  onChange={(e) => setAddress({...address, phone: e.target.value.replace(/\D/g, '').slice(0,15)})} 
                  inputMode="numeric" 
                  placeholder="Enter mobile number"
                />
                {error && error.toLowerCase().includes('phone') && (
                  <div className="mt-2 text-sm text-red-600">
                    {error}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <input 
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" 
                  value={address.line1} 
                  onChange={(e) => setAddress({...address, line1: e.target.value})}
                  placeholder="House no, Building, Street, Area"
                />
                {error && error.toLowerCase().includes('address') && (
                  <div className="mt-2 text-sm text-red-600">
                    {error}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input 
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" 
                    value={address.city} 
                    onChange={(e) => setAddress({...address, city: e.target.value})}
                    placeholder="City"
                  />
                  {error && error.toLowerCase().includes('city') && (
                    <div className="mt-2 text-sm text-red-600">
                      {error}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pincode</label>
                  <input 
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" 
                    value={address.pincode} 
                    onChange={(e) => setAddress({...address, pincode: e.target.value.replace(/\D/g, '').slice(0,6)})} 
                    inputMode="numeric" 
                    placeholder="Pincode"
                  />
                  {error && error.toLowerCase().includes('pincode') && (
                    <div className="mt-2 text-sm text-red-600">
                      {error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 sticky top-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Order Summary</h2>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>Items ({cartItems.length})</span>
                <span>₹{cartTotal}</span>
              </div>
              {platformFee > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Platform fee</span>
                  <span>₹{platformFee}</span>
                </div>
              )}
              {surgeFee > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Surge fee</span>
                  <span>₹{surgeFee}</span>
                </div>
              )}
              {otherFee > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Other fee</span>
                  <span>₹{otherFee}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Delivery</span>
                {deliveryFeeApplied > 0 ? (
                  <span>₹{deliveryFeeApplied}</span>
                ) : (
                  freeDeliveryMin > 0 ? (
                    <span className="text-green-600">Free (orders ≥ ₹{freeDeliveryMin})</span>
                  ) : (
                    <span className="text-green-600">Free</span>
                  )
                )}
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between font-semibold text-lg text-gray-800">
                  <span>Total</span>
                  <span>₹{totalWithFees}</span>
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
                onClick={placeOrder} 
                disabled={loading || !(cartItems && cartItems.length > 0) || (cartTotal || 0) < MIN_ORDER} 
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors"
              >
                {loading ? 'Processing...' : 'Place Order'}
              </button>
              <button 
                onClick={openWhatsApp} 
                disabled={loading || (cartTotal || 0) < MIN_ORDER}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12c0 2.68.93 5.16 2.78 7.07l-1.77 4.9 4.9-1.77C18.84 22.07 21 17.24 21 12c0-5.52-4.48-10-10-10zm1 17.93V19h-2v-1.07c-3.39-.48-6-3.1-6-6.43 0-3.54 2.91-6.43 6.43-6.43S19 8.46 19 12c0 3.33-2.54 6.1-5.83 6.93z"/>
                </svg>
                WhatsApp Order
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}