import React, { useState } from "react";
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from "../context/CartContext";
import Loader from "../components/Loader";
import Modal from "../components/Modal";
import { showToast } from "../components/Toast";
import { normalizeImageUrl } from '../utils/imageHelpers';
import { useFirebaseObject } from '../hooks/useFirebase';

export default function CartPage() {
  const { cartItems = [], cartTotal = 0, updateQuantity, removeFromCart, clearCart } = useCart() || {};
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const navigate = useNavigate();
  const { data: siteSettings } = useFirebaseObject('/siteSettings');

  const MIN_ORDER = 350;

  // Simple formatter
  const formatINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  const confirmClear = () => setShowConfirmClear(true);
  const doClear = () => {
    clearCart();
    setShowConfirmClear(false);
    showToast('Cart cleared');
  };

  const openWhatsApp = () => {
    const whatsappNumber = String(siteSettings?.whatsapp || siteSettings?.phone || '');
    const cleaned = whatsappNumber.replace(/[^0-9+]/g, '').replace(/^\+/, '');
    if (!cleaned) {
      showToast('WhatsApp number not configured', 'error');
      return;
    }

    if ((cartTotal || 0) < MIN_ORDER) {
      showToast(`Minimum order value is ₹${MIN_ORDER}`, 'error');
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
    lines.push(`Total: ₹${cartTotal}`);
    lines.push('');
    lines.push('Please reply with payment and delivery instructions.');

    const msg = encodeURIComponent(lines.join('\n'));
    const url = `https://wa.me/${cleaned}?text=${msg}`;
    window.open(url, '_blank');
  };

  if (!cartItems) return <Loader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your Cart</h1>
        <div className="text-sm text-neutral-600">{cartItems.length} item(s)</div>
      </div>

      {cartItems.length === 0 ? (
        <div className="card p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
          <p className="text-neutral-600 mb-6">Add items from collections to get started.</p>
          <div className="flex justify-center gap-3">
            <Link to="/" className="btn btn-primary">Go to Home</Link>
            <Link to="/groceries" className="btn btn-ghost">Browse Groceries</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => {
              const p = item.product || item;
              return (
                <div key={item.id} className="card flex items-center gap-4 p-4">
                  <img src={normalizeImageUrl(p.images?.[0]) || '/placeholder.jpg'} className="w-28 h-28 object-cover rounded-lg" alt={p.name} />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-lg">{p.name}</div>
                        <div className="text-sm text-neutral-500">{p.unit || p.variant || ''}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatINR(p.price)}</div>
                        <div className="text-sm text-neutral-500">Subtotal: {formatINR((p.price || 0) * (item.quantity || 1))}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button aria-label="Decrease quantity" onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="px-3 py-1 rounded-lg border bg-white">-</button>
                        <input type="number" min={1} value={item.quantity} onChange={(e)=>updateQuantity(item.id, Math.max(1, Number(e.target.value || 1)))} className="w-20 text-center border rounded-md p-1" />
                        <button aria-label="Increase quantity" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-3 py-1 rounded-lg border bg-white">+</button>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={()=>removeFromCart(item.id)} className="text-sm text-red-600">Remove</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-between">
              <button onClick={confirmClear} className="text-sm text-red-600">Clear cart</button>
              <div>
                <div className="text-lg font-semibold">Total: {formatINR(cartTotal)}</div>
                { (cartTotal || 0) < MIN_ORDER && (
                  <div className="text-sm text-red-600">Minimum order amount is ₹{MIN_ORDER}. Add more items to proceed.</div>
                )}
              </div>
            </div>
          </div>

          <aside className="card-glass p-6 rounded-lg shadow-md">
            <div className="sticky top-24">
              <h3 className="font-semibold text-lg mb-2">Order Summary</h3>
              <div className="mb-4 text-sm text-neutral-600">Items: {cartItems.length}</div>
              <div className="mb-4">Total: <span className="font-bold">{formatINR(cartTotal)}</span></div>
              <div className="space-y-2">
                <button onClick={() => navigate('/checkout')} className="w-full bg-primary-600 text-white py-2 rounded">Proceed to Checkout</button>
                <button onClick={openWhatsApp} className="w-full bg-green-600 text-white py-2 rounded" disabled={(cartTotal || 0) < MIN_ORDER}>Checkout via WhatsApp</button>
                <Link to="/" className="w-full block text-center border rounded py-2">Continue Shopping</Link>
              </div>
            </div>
          </aside>
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
