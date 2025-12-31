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
  const [paymentMethod, setPaymentMethod] = useState('cod');

  const MIN_ORDER = 350;
  const { data: siteSettings } = useFirebaseObject('/siteSettings');

  // Calculate fees
  const platformFee = Number(siteSettings?.platformFee || 15);
  const deliveryFee = Number(siteSettings?.deliveryFee || 0);
  const freeDeliveryMin = Number(siteSettings?.freeDeliveryMin || 199);
  const deliveryFeeApplied = freeDeliveryMin > 0 && (cartTotal || 0) >= freeDeliveryMin ? 0 : deliveryFee;
  const feesTotal = platformFee + deliveryFeeApplied;
  const totalWithFees = (cartTotal || 0) + feesTotal;

  useEffect(() => {
    if (!cartItems || cartItems.length === 0) {
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

    const order = {
      id: `order_${Date.now()}`,
      items: cartItems.map((it) => ({ 
        id: it.id, 
        name: it.product?.name || it.name || 'Item', 
        price: it.product?.price || it.price || 0, 
        quantity: it.quantity || 1 
      })),
      subtotal: cartTotal,
      fees: { platformFee, deliveryFee, deliveryFeeApplied, feesTotal },
      total: totalWithFees,
      address: { ...address },
      createdAt: new Date().toISOString(),
    };

    try {
      const amountPaise = Math.round((totalWithFees || 0) * 100);
      const serverResp = await createOrderOnServer(amountPaise);
      const orderId = serverResp?.order_id || serverResp?.id || serverResp?.razorpay_order_id;
      const rkey = siteSettings?.razorpayKey || import.meta.env.VITE_RAZORPAY_KEY || serverResp?.key;

      if (!rkey) {
        try {
          await createOrderInDb(order);
        } catch (dbErr) {
          console.warn('Failed to save order to Firebase:', dbErr);
          showToast('Order placed but saving failed', 'warning');
        }
        clearCart();
        setPlacedOrder(order);
        showToast('Order placed');
        setLoading(false);
        return;
      }

      await openRazorpayCheckout({
        key: rkey,
        amountINR: totalWithFees,
        name: siteSettings?.brandName || 'FreshMart',
        description: 'Order Payment',
        prefill: { name: address.name, contact: address.phone },
        orderId,
        onSuccess: async (resp) => {
          const paymentInfo = {
            razorpayPaymentId: resp?.razorpay_payment_id,
            razorpayOrderId: resp?.razorpay_order_id,
            razorpaySignature: resp?.razorpay_signature
          };

          const finalOrder = { ...order, payment: paymentInfo };
          const safeOrder = JSON.parse(JSON.stringify(finalOrder, (_key, value) => (value === undefined ? null : value)));

          try {
            await createOrderInDb(safeOrder);
          } catch (dbErr) {
            console.warn('Failed to save order to Firebase:', dbErr);
            showToast('Payment succeeded but saving failed', 'warning');
          }

          clearCart();
          setPlacedOrder(finalOrder);
          showToast('Payment successful!', 'success');
          setLoading(false);
        },
        onFailure: (err) => {
          console.error('Payment failed', err);
          setError('Payment failed or cancelled');
          showToast('Payment failed', 'error');
          setLoading(false);
        }
      });
    } catch (err) {
      console.error('Failed to place order:', err);
      setError('Failed to start payment');
      setLoading(false);
    }
  };

  // Build WhatsApp message and open chat
  const openWhatsApp = () => {
    const whatsappNumber = String(siteSettings?.whatsapp || siteSettings?.phone || '');
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
      lines.push(`${idx + 1}. ${p.name} x ${item.quantity} - ₹${p.price || 0}`);
    });
    lines.push('');
    if(platformFee) lines.push(`Platform fee: ₹${platformFee}`);
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
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-green-50 to-white flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-white">✓</span>
            </div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Order Placed Successfully!</h1>
            <p className="text-sm text-gray-600">Thank you {placedOrder.address.name}, your order is confirmed</p>
          </div>
          
          <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-purple-100 p-6 shadow-sm mb-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-purple-100">
                <span className="text-sm text-gray-600">Order ID</span>
                <span className="font-mono text-xs bg-purple-100 px-2 py-1 rounded">{placedOrder.id}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Amount</span>
                <span className="text-lg font-bold text-gray-800">₹{placedOrder.total}</span>
              </div>

              <div className="pt-3 border-t border-purple-100">
                <div className="text-xs text-gray-500 mb-2">Delivery Address</div>
                <div className="text-sm text-gray-800">
                  <div className="font-medium">{placedOrder.address.name}</div>
                  <div className="text-xs text-gray-600">{placedOrder.address.line1}</div>
                  <div className="text-xs text-gray-600">{placedOrder.address.city} - {placedOrder.address.pincode}</div>
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <span>📞</span>
                    <span>{placedOrder.address.phone}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Link to="/" className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 text-center rounded-xl font-medium transition-colors text-sm">
              Continue Shopping
            </Link>
            <Link to="/groceries" className="flex-1 border border-purple-200 text-purple-600 py-3 text-center rounded-xl font-medium transition-colors text-sm hover:bg-purple-50">
              Browse More
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-green-50 to-white relative">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-purple-100">
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-800">Checkout</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pb-32 pt-4 space-y-4">
        {/* Order Summary Card */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-purple-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-green-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">1</span>
            </div>
            <h2 className="text-base font-semibold text-gray-800">Order Summary</h2>
            <span className="text-sm text-gray-500">({cartItems.length} item{cartItems.length !== 1 ? 's' : ''})</span>
          </div>
          
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {cartItems.map((item, index) => {
              const product = item.product || item;
              return (
                <div key={index} className="flex items-center gap-3 py-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-green-100 rounded-lg flex items-center justify-center">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-10 h-10 object-cover rounded-lg" />
                    ) : (
                      <span className="text-purple-600 text-xs">📦</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800 text-sm truncate">{product.name}</h3>
                    <p className="text-xs text-gray-500">
                      ₹{product.price || 0} × {item.quantity}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-gray-800">
                    ₹{(product.price || 0) * item.quantity}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Delivery Address Card */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-purple-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-green-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">2</span>
            </div>
            <h2 className="text-base font-semibold text-gray-800">Delivery Address</h2>
          </div>
          
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <input
                type="text"
                placeholder="Full Name"
                value={address.name}
                onChange={(e) => setAddress({...address, name: e.target.value})}
                className="w-full px-3 py-2.5 bg-white/50 border border-purple-200 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={address.phone}
                onChange={(e) => setAddress({...address, phone: e.target.value.replace(/\D/g, '').slice(0,15)})}
                className="w-full px-3 py-2.5 bg-white/50 border border-purple-200 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <textarea
                placeholder="House No, Building Name, Area"
                value={address.line1}
                onChange={(e) => setAddress({...address, line1: e.target.value})}
                className="w-full px-3 py-2.5 bg-white/50 border border-purple-200 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-[60px]"
                rows={2}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="City"
                  value={address.city}
                  onChange={(e) => setAddress({...address, city: e.target.value})}
                  className="w-full px-3 py-2.5 bg-white/50 border border-purple-200 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="Pincode"
                  value={address.pincode}
                  onChange={(e) => setAddress({...address, pincode: e.target.value.replace(/\D/g, '').slice(0,6)})}
                  className="w-full px-3 py-2.5 bg-white/50 border border-purple-200 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            {error && (
              <div className="text-xs text-red-500 bg-red-50 p-2 rounded-lg">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Bill Summary Card */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-purple-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-green-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">3</span>
            </div>
            <h2 className="text-base font-semibold text-gray-800">Bill Summary</h2>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Items ({cartItems.length})</span>
              <span className="font-medium text-gray-800">₹{cartTotal}</span>
            </div>
            {platformFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Platform Fee</span>
                <span className="font-medium text-gray-800">₹{platformFee}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Delivery Fee</span>
              {deliveryFeeApplied > 0 ? (
                <span className="font-medium text-gray-800">₹{deliveryFeeApplied}</span>
              ) : (
                freeDeliveryMin > 0 ? (
                  <span className="font-medium text-green-600">Free (orders ≥ ₹{freeDeliveryMin})</span>
                ) : (
                  <span className="font-medium text-green-600">Free</span>
                )
              )}
            </div>
            <div className="border-t border-purple-200 pt-2 mt-3">
              <div className="flex justify-between text-base font-semibold">
                <span className="text-gray-800">Total Amount</span>
                <span className="text-gray-900">₹{totalWithFees}</span>
              </div>
            </div>
            {(cartTotal || 0) < MIN_ORDER && (
              <div className="text-xs text-red-600 bg-red-50 p-3 rounded-lg mt-3">
                Minimum order amount is ₹{MIN_ORDER}. Add ₹{MIN_ORDER - (cartTotal || 0)} more to proceed.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-purple-100 p-4 z-30">
        <div className="flex gap-3">
          <button
            onClick={openWhatsApp}
            disabled={loading || !address.name || !address.phone || !address.line1 || !address.city || !address.pincode || (cartTotal || 0) < MIN_ORDER}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-3 px-4 rounded-xl transition-colors duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            <span className="text-lg">📱</span>
            <span className="text-sm">WhatsApp Order</span>
          </button>
          <button
            onClick={placeOrder}
            disabled={loading || !address.name || !address.phone || !address.line1 || !address.city || !address.pincode || (cartTotal || 0) < MIN_ORDER}
            className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span className="text-lg">🛒</span>
                <span className="text-sm">Place Order</span>
              </>
            )}
          </button>
        </div>
        <div className="text-center mt-2">
          <span className="text-xs text-gray-600">Total: </span>
          <span className="text-sm font-bold text-purple-600">₹{totalWithFees}</span>
        </div>
      </div>
    </div>
  );
}