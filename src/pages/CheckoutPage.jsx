import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAddress } from '../context/AddressContext';
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
  const { selectedAddress } = useAddress();
  const [pricingConfig, setPricingConfig] = useState(null);
  const navigate = useNavigate();

  // Address is now handled by AddressContext - removed local state
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
      if (selectedAddress && selectedAddress.line1 && selectedAddress.city && selectedAddress.pincode) {
        calculateDeliveryFeeForAddress();
      }
    });
    
    return unsubscribe;
  }, [selectedAddress]);

  // Calculate delivery fee when address changes
  useEffect(() => {
    const calculateDeliveryFeeForAddress = async () => {
      if (selectedAddress && selectedAddress.line1 && selectedAddress.city && selectedAddress.pincode) {
        setCalculatingDeliveryFee(true);
        try {
          // Calculate distance from store to delivery address
          const storeAddress = siteSettings?.storeAddress || 'Store Location';
          const customerAddress = `${selectedAddress.line1}, ${selectedAddress.city}, ${selectedAddress.pincode}`;
          
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
  }, [selectedAddress, cartTotal, siteSettings]);

  // Note: Address defaults now handled by AddressContext - removed redundant useEffect
  
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
    if (!selectedAddress?.name?.trim()) return 'Please enter full name';
    if (!/^[0-9]{6,15}$/.test(selectedAddress?.phone?.replace(/\D/g, '') || '')) return 'Please enter a valid phone number';
    if (!selectedAddress?.line1?.trim()) return 'Please enter address line';
    if (!selectedAddress?.city?.trim()) return 'Please enter city';
    if (!/^[0-9]{5,6}$/.test(selectedAddress?.pincode || '')) return 'Please enter a valid pincode';
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
        address: { ...selectedAddress },
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
      address: { ...selectedAddress },
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
        prefill: { name: selectedAddress?.name, contact: selectedAddress?.phone },
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
    if (selectedAddress?.name || selectedAddress?.line1) {
      lines.push('');
      lines.push('Shipping to:');
      lines.push(`${selectedAddress?.name || ''}`);
      lines.push(`${selectedAddress?.line1 || ''}, ${selectedAddress?.city || ''} - ${selectedAddress?.pincode || ''}`);
      lines.push(`Phone: ${selectedAddress?.phone || ''}`);
    }

    const msg = encodeURIComponent(lines.join('\n'));
    const url = `https://wa.me/${cleaned.replace(/^\+/, '')}?text=${msg}`;
    window.open(url, '_blank');
  };

  if (placedOrder) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Order Confirmed!</h1>
            <p className="text-sm text-gray-600">Thank you {placedOrder.address.name}</p>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">Order ID</span>
                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-800">{placedOrder.id}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Amount</span>
                <span className="text-lg font-bold text-gray-900">₹{placedOrder.total}</span>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-2">Delivery Address</div>
                <div className="text-sm text-gray-800">
                  <div className="font-medium">{placedOrder.address.name}</div>
                  <div className="text-xs text-gray-600">{placedOrder.address.line1}</div>
                  <div className="text-xs text-gray-600">{placedOrder.address.city} - {placedOrder.address.pincode}</div>
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                    <span>{placedOrder.address.phone}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Link to="/" className="flex-1 bg-green-500 text-white py-3 text-center rounded-lg font-medium transition-colors text-sm hover:bg-green-600">
              Continue Shopping
            </Link>
            <Link to="/groceries" className="flex-1 border border-gray-300 text-gray-700 py-3 text-center rounded-lg font-medium transition-colors text-sm hover:bg-gray-50">
              Browse More
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="text-gray-700 hover:text-gray-900 transition-colors p-1"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Checkout</h1>
          <div className="ml-auto text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full">
            {cartItems.length} item{cartItems.length !== 1 ? 's' : ''}
          </div>
        </div>
        
        {/* Delivery Address Preview */}
        {selectedAddress && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-600">Delivering to: </span>
              <span className="text-gray-800 font-medium">
                {selectedAddress.line1}, {selectedAddress.city} - {selectedAddress.pincode}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="pb-24 space-y-3">
        
        {/* Delivery Address Section */}
        <div className="bg-white mx-4 rounded-lg shadow-sm border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="font-medium text-gray-900 text-sm">Delivery Address</h3>
            </div>
          </div>
          <div className="p-4">
            {selectedAddress ? (
              <div className="space-y-2">
                <div className="font-medium text-gray-900">{selectedAddress.name}</div>
                <div className="text-sm text-gray-600">{selectedAddress.phone}</div>
                <div className="text-sm text-gray-600">
                  {selectedAddress.line1}, {selectedAddress.city}, {selectedAddress.pincode}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Selected Address
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                Please select a delivery address
              </div>
            )}
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white mx-4 rounded-lg shadow-sm border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900 text-sm">Order Summary</h3>
              <span className="text-xs text-gray-500">{cartItems.length} item{cartItems.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="p-4 space-y-3 max-h-48 overflow-y-auto">
            {cartItems.map((item, index) => {
              const product = item.product || item;
              return (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-600 text-xs font-medium">{item.quantity}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">{product.name}</h4>
                    <p className="text-xs text-gray-500">₹{product.price || 0} each</p>
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    ₹{(product.price || 0) * item.quantity}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white mx-4 rounded-lg shadow-sm border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                  <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="font-medium text-gray-900 text-sm">Payment Method</h3>
            </div>
          </div>
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Online Payment</p>
                <p className="text-xs text-gray-600">UPI, Cards, Net Banking</p>
              </div>
              <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Recommended</div>
            </div>
            <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
              <div className="w-4 h-4 border-2 border-gray-300 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Cash on Delivery</p>
                <p className="text-xs text-gray-600">Pay when order arrives</p>
              </div>
            </div>
          </div>
        </div>

        {/* Promo Code */}
        {!appliedPromo && (
          <div className="bg-white mx-4 rounded-lg shadow-sm border border-gray-100">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="font-medium text-gray-900 text-sm">Apply Coupon</h3>
              </div>
            </div>
            <div className="p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value.toUpperCase());
                    setPromoError('');
                  }}
                  placeholder="Enter coupon code"
                  className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 bg-gray-50 font-mono uppercase"
                />
                <button
                  onClick={validateAndApplyPromo}
                  disabled={promoLoading || !promoCode.trim()}
                  className="px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {promoLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Apply'
                  )}
                </button>
              </div>
              {promoError && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg mt-2">
                  {promoError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Applied Promo */}
        {appliedPromo && (
          <div className="bg-white mx-4 rounded-lg shadow-sm border border-green-200">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-green-800 text-sm">{appliedPromo.code}</p>
                    <p className="text-xs text-green-600">You saved ₹{discount.toFixed(2)}!</p>
                  </div>
                </div>
                <button
                  onClick={removePromo}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bill Details */}
        <div className="bg-white mx-4 rounded-lg shadow-sm border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-medium text-gray-900 text-sm">Bill Details</h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Item Total</span>
              <span className="text-gray-900">₹{cartTotal}</span>
            </div>
            
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  Coupon Discount
                </span>
                <span className="text-green-600">-₹{discount.toFixed(2)}</span>
              </div>
            )}
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 flex items-center gap-1">
                Delivery Fee
                {calculatingDeliveryFee && (
                  <svg className="animate-spin w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
              </span>
              {deliveryFeeApplied > 0 ? (
                <span className="text-gray-900">₹{deliveryFeeApplied}</span>
              ) : (
                <span className="text-green-600 font-medium">FREE</span>
              )}
            </div>

            {deliveryFeeData.distance > 0 && (
              <div className="text-xs text-gray-500 pl-4">
                Distance: {deliveryFeeData.distance.toFixed(1)} km
                {deliveryFeeData.reasons && deliveryFeeData.reasons.length > 0 && (
                  <span> • {deliveryFeeData.reasons.join(', ')}</span>
                )}
              </div>
            )}
            
            {platformFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Platform Fee</span>
                <span className="text-gray-900">₹{platformFee}</span>
              </div>
            )}
            
            <div className="border-t border-gray-100 pt-3 mt-3">
              <div className="flex justify-between text-base">
                <span className="font-semibold text-gray-900">Total Amount</span>
                <span className="font-semibold text-gray-900">₹{totalWithFees}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* Minimum Order Warning */}
        {(cartTotal || 0) < MIN_ORDER && (
          <div className="mx-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="text-sm">
                <span className="text-orange-700">Minimum order ₹{MIN_ORDER}. </span>
                <span className="text-orange-600">Add ₹{MIN_ORDER - (cartTotal || 0)} more to proceed.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500">Total Amount</p>
              <p className="text-lg font-bold text-gray-900">₹{totalWithFees}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={openWhatsApp}
                disabled={loading || !selectedAddress?.name || !selectedAddress?.phone || !selectedAddress?.line1 || !selectedAddress?.city || !selectedAddress?.pincode || (cartTotal || 0) < MIN_ORDER}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-4 py-2.5 rounded-lg transition-colors disabled:cursor-not-allowed text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.516"/>
                </svg>
                WhatsApp
              </button>
              <button
                onClick={placeOrder}
                disabled={loading || !selectedAddress?.name || !selectedAddress?.phone || !selectedAddress?.line1 || !selectedAddress?.city || !selectedAddress?.pincode || (cartTotal || 0) < MIN_ORDER}
                className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-3 px-6 rounded-lg transition-colors disabled:cursor-not-allowed text-sm font-semibold min-w-0"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  <span>Place Order</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}