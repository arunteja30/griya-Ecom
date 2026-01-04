import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { createOrder as createOrderInDb, createMerchantOrders as createMerchantOrdersInDb } from '../firebaseApi';
import { showToast } from '../components/Toast';
import { useFirebaseObject } from '../hooks/useFirebase';
import { createOrderOnServer, openRazorpayCheckout } from '../utils/razorpay';
import { isStoreOpen, getStoreStatus } from '../utils/storeHours';
import { estimateDeliveryFee, calculateDistance, subscribeToPricingConfig } from '../utils/deliveryFeeCalculator';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../firebase';

export default function CheckoutPage() {
  const { cartItems = [], cartTotal = 0, clearCart } = useCart() || {};
  const [pricingConfig, setPricingConfig] = useState(null);
  const navigate = useNavigate();

  const [address, setAddress] = useState({ name: '', phone: '', line1: '', city: '', pincode: '' });
  const [loading, setLoading] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [error, setError] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  
  // Promo code state
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [discount, setDiscount] = useState(0);

  const MIN_ORDER = 350;
  const { data: siteSettings } = useFirebaseObject('/siteSettings');

  // Calculate fees
  const platformFee = Number(siteSettings?.platformFee || 15);
  
  // Dynamic delivery fee calculation
  const [deliveryFeeData, setDeliveryFeeData] = useState({
    total: Number(siteSettings?.deliveryFee || 0),
    breakdown: null,
    distance: 0
  });
  const [calculatingDeliveryFee, setCalculatingDeliveryFee] = useState(false);
  
  const deliveryFeeApplied = deliveryFeeData.total;
  const feesTotal = platformFee + deliveryFeeApplied;
  const subtotalAfterDiscount = Math.max(0, (cartTotal || 0) - discount);
  const totalWithFees = subtotalAfterDiscount + feesTotal;

  useEffect(() => {
    if (!cartItems || cartItems.length === 0) {
      if (!placedOrder) navigate('/cart');
    }
  }, [cartItems, navigate, placedOrder]);

  // Listen to real-time pricing config changes
  useEffect(() => {
    const unsubscribe = subscribeToPricingConfig((config) => {
      setPricingConfig(config);
      // Recalculate delivery fee when config changes
      if (address.line1 && address.city && address.pincode) {
        calculateDeliveryFeeForAddress();
      }
    });
    
    return unsubscribe;
  }, []);

  // Listen to real-time pricing config changes
  useEffect(() => {
    const unsubscribe = subscribeToPricingConfig((config) => {
      setPricingConfig(config);
      // Recalculate delivery fee when config changes
      if (address.line1 && address.city && address.pincode) {
        calculateDeliveryFeeForAddress();
      }
    });
    
    return unsubscribe;
  }, []);

  // Calculate delivery fee when address changes
  useEffect(() => {
    const calculateDeliveryFeeForAddress = async () => {
      if (address.line1 && address.city && address.pincode) {
        setCalculatingDeliveryFee(true);
        try {
          // Calculate distance from store to delivery address
          const storeAddress = siteSettings?.storeAddress || 'Store Location';
          const customerAddress = `${address.line1}, ${address.city}, ${address.pincode}`;
          
          // Get distance (you should implement actual Google Maps API call)
          const distanceData = await calculateDistance(storeAddress, customerAddress);
          
          // Calculate delivery fee based on distance and order value
          const feeData = await estimateDeliveryFee(cartTotal || 0, distanceData.distance);
          
          setDeliveryFeeData({
            total: feeData.total,
            breakdown: feeData.breakdown,
            distance: distanceData.distance,
            reasons: feeData.reasons
          });
        } catch (error) {
          console.error('Error calculating delivery fee:', error);
          // Fallback to default fee
          setDeliveryFeeData({
            total: Number(siteSettings?.deliveryFee || 0),
            breakdown: null,
            distance: 0
          });
        } finally {
          setCalculatingDeliveryFee(false);
        }
      } else {
        // Reset to default when address is incomplete
        setDeliveryFeeData({
          total: Number(siteSettings?.deliveryFee || 0),
          breakdown: null,
          distance: 0
        });
      }
    };
    
    calculateDeliveryFeeForAddress();
  }, [address.line1, address.city, address.pincode, cartTotal, siteSettings]);
  
  useEffect(() => {
    if (siteSettings && (!address.city || !address.pincode)) {
      const defaultCity = siteSettings.defaultCity || '';
      const defaultPincode = siteSettings.defaultPincode || '';
      
      // If no default pincode is set, use the first serviceable pincode
      let pincode = defaultPincode;
      if (!pincode && siteSettings.serviceablePincodes) {
        if (Array.isArray(siteSettings.serviceablePincodes) && siteSettings.serviceablePincodes.length > 0) {
          pincode = siteSettings.serviceablePincodes[0];
        } else if (typeof siteSettings.serviceablePincodes === 'string') {
          const pincodes = siteSettings.serviceablePincodes.split(/[\n,]/).map(p => p.trim()).filter(Boolean);
          if (pincodes.length > 0) {
            pincode = pincodes[0];
          }
        }
      }
      
      if (defaultCity || pincode) {
        setAddress(prev => ({
          ...prev,
          city: prev.city || defaultCity,
          pincode: prev.pincode || pincode
        }));
      }
    }
  }, [siteSettings, address.city, address.pincode]);

  // Promo code validation function
  const validateAndApplyPromo = async () => {
    if (!promoCode.trim()) {
      setPromoError('Please enter a promo code');
      return;
    }

    setPromoLoading(true);
    setPromoError('');

    try {
      const promocodesRef = ref(db, 'promocodes');
      onValue(promocodesRef, (snapshot) => {
        if (snapshot.exists()) {
          const promocodes = snapshot.val();
          const foundPromo = Object.entries(promocodes).find(([id, promo]) => 
            promo.code?.toUpperCase() === promoCode.toUpperCase().trim()
          );

          if (!foundPromo) {
            setPromoError('Invalid promo code');
            setPromoLoading(false);
            return;
          }

          const [promoId, promo] = foundPromo;
          const now = Date.now();

          // Check if promo is active
          if (!promo.isActive) {
            setPromoError('This promo code is not active');
            setPromoLoading(false);
            return;
          }

          // Check date validity
          if (promo.startDate && now < promo.startDate) {
            setPromoError('This promo code is not yet valid');
            setPromoLoading(false);
            return;
          }

          if (promo.endDate && now > promo.endDate) {
            setPromoError('This promo code has expired');
            setPromoLoading(false);
            return;
          }

          // Check usage limits
          if (promo.maxUses && (promo.usedCount || 0) >= promo.maxUses) {
            setPromoError('This promo code has reached its usage limit');
            setPromoLoading(false);
            return;
          }

          // Check minimum order amount
          if (promo.minOrderAmount && (cartTotal || 0) < promo.minOrderAmount) {
            setPromoError(`Minimum order amount for this promo is ₹${promo.minOrderAmount}`);
            setPromoLoading(false);
            return;
          }

          // Calculate discount
          let calculatedDiscount = 0;
          if (promo.discountType === 'percent') {
            calculatedDiscount = ((cartTotal || 0) * promo.discountValue) / 100;
            if (promo.maxDiscountAmount) {
              calculatedDiscount = Math.min(calculatedDiscount, promo.maxDiscountAmount);
            }
          } else {
            calculatedDiscount = promo.discountValue;
          }

          // Apply discount
          setDiscount(calculatedDiscount);
          setAppliedPromo({ ...promo, id: promoId });
          setPromoError('');
          showToast(`Promo code applied! You saved ₹${calculatedDiscount.toFixed(2)}`, 'success');
        } else {
          setPromoError('Invalid promo code');
        }
        setPromoLoading(false);
      }, { once: true });
    } catch (error) {
      console.error('Error validating promo code:', error);
      setPromoError('Error validating promo code');
      setPromoLoading(false);
    }
  };

  // Remove promo code
  const removePromo = () => {
    setDiscount(0);
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError('');
    showToast('Promo code removed', 'success');
  };

  const validate = () => {
    if (!address.name.trim()) return 'Please enter full name';
    if (!/^[0-9]{6,15}$/.test(address.phone.replace(/\D/g, ''))) return 'Please enter a valid phone number';
    if (!address.line1.trim()) return 'Please enter address line';
    if (!address.city.trim()) return 'Please enter city';
    if (!/^[0-9]{5,6}$/.test(address.pincode)) return 'Please enter a valid pincode';
    if (!cartItems || cartItems.length === 0) return 'Your cart is empty';
    if ((cartTotal || 0) < MIN_ORDER) return `Minimum order value is ₹${MIN_ORDER}`;
    
    // Check if store is open
    const storeIsOpen = isStoreOpen(siteSettings);
    if (storeIsOpen === false) return 'Store is currently closed. Please try again during business hours.';
    
    return null;
  };

  const placeOrder = async () => {
    const v = validate();
    if (v) return setError(v);
    
    setError(null);
    setLoading(true);

    // Group cart items by merchantId
    const itemsByMerchant = cartItems.reduce((acc, item) => {
      const merchantId = item.product?.merchantId || 'global';
      if (!acc[merchantId]) {
        acc[merchantId] = [];
      }
      acc[merchantId].push({
        id: item.id, 
        name: item.product?.name || item.name || 'Item', 
        price: item.product?.price || item.price || 0, 
        quantity: item.quantity || 1,
        merchantId: item.product?.merchantId || null,
        // Preserve product structure for inventory operations
        product: item.product,
        _merchantSpecific: !!item.product?.merchantId
      });
      return acc;
    }, {});

    // Calculate totals for each merchant
    const merchantOrders = Object.entries(itemsByMerchant).map(([merchantId, items]) => {
      const merchantSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const merchantFeesRatio = merchantSubtotal / cartTotal; // proportional fees
      const merchantPlatformFee = Math.round(platformFee * merchantFeesRatio);
      const merchantDeliveryFee = Math.round(deliveryFeeApplied * merchantFeesRatio);
      const merchantFeesTotal = merchantPlatformFee + merchantDeliveryFee;
      const merchantTotal = merchantSubtotal + merchantFeesTotal;
      
      return {
        id: `order_${Date.now()}_${merchantId}`,
        merchantId: merchantId === 'global' ? null : merchantId,
        items,
        subtotal: merchantSubtotal,
        fees: { 
          platformFee: merchantPlatformFee, 
          deliveryFee: merchantDeliveryFee, 
          deliveryFeeApplied, 
          feesTotal: merchantFeesTotal 
        },
        total: merchantTotal,
        address: { ...address },
        createdAt: new Date().toISOString(),
      };
    });

    // For payment, use the combined total but save separate orders
    const order = {
      id: `order_${Date.now()}`,
      items: cartItems.map((it) => ({ 
        id: it.id, 
        name: it.product?.name || it.name || 'Item', 
        price: it.product?.price || it.price || 0, 
        quantity: it.quantity || 1,
        merchantId: it.product?.merchantId || null,
        // Preserve product structure for inventory operations
        product: it.product,
        _merchantSpecific: !!it.product?.merchantId
      })),
      subtotal: cartTotal,
      discount: discount,
      promoCode: appliedPromo ? {
        code: appliedPromo.code,
        discountType: appliedPromo.discountType,
        discountValue: appliedPromo.discountValue,
        appliedDiscount: discount
      } : null,
      fees: { 
        platformFee, 
        deliveryFee: deliveryFeeData.total, 
        deliveryFeeApplied, 
        feesTotal,
        breakdown: deliveryFeeData.breakdown
      },
      distance: deliveryFeeData.distance,
      deliveryFeeCalculation: deliveryFeeData,
      total: totalWithFees,
      address: { ...address },
      createdAt: new Date().toISOString(),
      merchantOrders // include merchant-specific orders
    };

    try {
      // Increment promo code usage if applied
      if (appliedPromo) {
        const promoRef = ref(db, `promocodes/${appliedPromo.id}`);
        await update(promoRef, {
          usedCount: (appliedPromo.usedCount || 0) + 1,
          updatedAt: Date.now()
        });
      }
      
      console.log('Creating order with amount:', totalWithFees);
      const amountPaise = Math.round((totalWithFees || 0) * 100);
      console.log('Amount in paise:', amountPaise);
      
      const serverResp = await createOrderOnServer(amountPaise);
      console.log('Server response:', serverResp);
      
      const orderId = serverResp?.order_id || serverResp?.id || serverResp?.razorpay_order_id;
      const rkey = siteSettings?.razorpayKey || import.meta.env.VITE_RAZORPAY_KEY || serverResp?.key;
      
      console.log('Razorpay key available:', !!rkey);
      console.log('Order ID:', orderId);

      if (!rkey) {
        console.warn('No Razorpay key found, proceeding with COD order');
        try {
          // Clean the order object to remove undefined values (Firebase doesn't accept undefined)
          const safeOrder = JSON.parse(JSON.stringify(order, (_key, value) => (value === undefined ? null : value)));
          const safeMerchantOrders = JSON.parse(JSON.stringify(merchantOrders, (_key, value) => (value === undefined ? null : value)));
          
          // Save main order first
          const mainOrderResult = await createOrderInDb(safeOrder);
          const mainOrderId = mainOrderResult.key;
          
          // Update merchant orders with main order ID reference
          const merchantOrdersWithRef = safeMerchantOrders.map(mo => ({
            ...mo,
            mainOrderId: mainOrderId
          }));
          
          // Save merchant-specific orders
          await createMerchantOrdersInDb(merchantOrdersWithRef);
          
          // Add order to floating tracker
          if (window.addOrderToTracking) {
            window.addOrderToTracking({ ...safeOrder, id: mainOrderId });
          }
        } catch (dbErr) {
          console.error('Failed to save order to Firebase:', dbErr);
          showToast('Order placed but saving failed', 'warning');
        }
        clearCart();
        setPlacedOrder(order);
        showToast('Order placed');
        setLoading(false);
        return;
      }

      console.log('Initiating Razorpay payment...');
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
          
          // Update merchant orders with payment info and clean undefined values
          const merchantOrdersWithPayment = merchantOrders.map(mo => ({
            ...mo,
            payment: paymentInfo
          }));
          const safeMerchantOrdersWithPayment = JSON.parse(JSON.stringify(merchantOrdersWithPayment, (_key, value) => (value === undefined ? null : value)));

          try {
            // Save main order first
            const mainOrderResult = await createOrderInDb(safeOrder);
            const mainOrderId = mainOrderResult.key;
            
            // Update merchant orders with main order ID reference and payment info
            const merchantOrdersWithRef = safeMerchantOrdersWithPayment.map(mo => ({
              ...mo,
              mainOrderId: mainOrderId
            }));
            
            // Save merchant-specific orders with payment info
            await createMerchantOrdersInDb(merchantOrdersWithRef);
            
            // Add order to floating tracker
            if (window.addOrderToTracking) {
              window.addOrderToTracking({ ...safeOrder, id: mainOrderId });
            }
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
      {/* Header Toolbar */}
      <div className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-4 flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="text-gray-600 hover:text-gray-900 transition-colors p-2 -ml-2 rounded-full hover:bg-gray-100"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Checkout</h1>
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
                className="w-full px-3 py-2.5 bg-white/50 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={address.phone}
                onChange={(e) => setAddress({...address, phone: e.target.value.replace(/\D/g, '').slice(0,15)})}
                className="w-full px-3 py-2.5 bg-white/50 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <textarea
                placeholder="House No, Building Name, Area"
                value={address.line1}
                onChange={(e) => setAddress({...address, line1: e.target.value})}
                className="w-full px-3 py-2.5 bg-white/50 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[60px]"
                rows={2}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="City"
                  value={address.city}
                  onChange={(e) => setAddress({...address, city: e.target.value})}
                  className="w-full px-3 py-2.5 bg-white/50 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  type="text"
                  placeholder="Pincode"
                  value={address.pincode}
                  onChange={(e) => setAddress({...address, pincode: e.target.value.replace(/\D/g, '').slice(0,6)})}
                  className="w-full px-3 py-2.5 bg-white/50 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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

        {/* Promo Code Card */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-purple-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-green-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">🏷️</span>
            </div>
            <h2 className="text-base font-semibold text-gray-800">Promo Code</h2>
          </div>
          
          {appliedPromo ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-green-800 text-sm">{appliedPromo.code}</p>
                    <p className="text-xs text-green-600">You saved ₹{discount.toFixed(2)}!</p>
                  </div>
                </div>
                <button
                  onClick={removePromo}
                  className="text-green-600 hover:text-green-800 transition-colors p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value.toUpperCase());
                    setPromoError('');
                  }}
                  placeholder="Enter promo code"
                  className="flex-1 px-3 py-2 bg-white/50 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono uppercase"
                />
                <button
                  onClick={validateAndApplyPromo}
                  disabled={promoLoading || !promoCode.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-1"
                >
                  {promoLoading ? (
                    <>
                      <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Applying
                    </>
                  ) : (
                    'Apply'
                  )}
                </button>
              </div>
              {promoError && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">
                  {promoError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bill Summary Card */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-purple-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-green-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">4</span>
            </div>
            <h2 className="text-base font-semibold text-gray-800">Bill Summary</h2>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Items ({cartItems.length})</span>
              <span className="font-medium text-gray-800">₹{cartTotal}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Discount ({appliedPromo?.code})</span>
                <span className="font-medium text-green-600">-₹{discount.toFixed(2)}</span>
              </div>
            )}
            {platformFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Platform Fee</span>
                <span className="font-medium text-gray-800">₹{platformFee}</span>
              </div>
            )}
            <div className="py-2">
              <div className="flex justify-between">
                <span className="text-gray-600 flex items-center">
                  Delivery Fee
                  {calculatingDeliveryFee && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                </span>
                {deliveryFeeApplied > 0 ? (
                  <span className="font-medium text-gray-800">₹{deliveryFeeApplied}</span>
                ) : (
                  <span className="text-green-600 font-medium">FREE</span>
                )}
              </div>
              {deliveryFeeData.distance > 0 && !deliveryFeeData.adminOverride && (
                <div className="text-xs text-gray-500 mt-1 flex justify-between">
                  <span>Distance: {deliveryFeeData.distance.toFixed(1)} km</span>
                  {deliveryFeeData.reasons && deliveryFeeData.reasons.length > 0 && (
                    <span>{deliveryFeeData.reasons.join(', ')}</span>
                  )}
                </div>
              )}
              {deliveryFeeData.adminOverride && (
                <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                  <span>💼</span>
                  <span>{deliveryFeeData.reasons?.[0] || 'Admin controlled pricing'}</span>
                </div>
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
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            <span className="text-lg">📱</span>
            <span className="text-sm">WhatsApp Order</span>
          </button>
          <button
            onClick={placeOrder}
            disabled={loading || !address.name || !address.phone || !address.line1 || !address.city || !address.pincode || (cartTotal || 0) < MIN_ORDER}
            className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
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