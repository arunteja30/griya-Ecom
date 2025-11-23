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
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Delivery Information</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input 
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" 
                  value={address.name} 
                  onChange={(e) => setAddress({...address, name: e.target.value})}
                  placeholder="Enter your full name"
                />
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <input 
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" 
                  value={address.line1} 
                  onChange={(e) => setAddress({...address, line1: e.target.value})}
                  placeholder="House no, Building, Street, Area"
                />
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
              <div className="flex justify-between text-gray-600">
                <span>Delivery</span>
                <span className="text-green-600">Free</span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between font-semibold text-lg text-gray-800">
                  <span>Total</span>
                  <span>₹{cartTotal}</span>
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
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.097"/>
                </svg>
                Order via WhatsApp
              </button>
              
              <Link 
                to="/cart" 
                className="w-full block text-center border border-gray-300 hover:border-gray-400 text-gray-700 py-3 rounded-lg font-medium transition-colors"
              >
                Back to Cart
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
