import React, { useContext, useEffect, useState } from "react";
import { CartContext } from "../context/CartContext";
import { useFirebaseObject } from "../hooks/useFirebase";
import Loader from "../components/Loader";
import Modal from "../components/Modal";
import { showToast } from "../components/Toast";
import { normalizeImageUrl } from '../utils/imageHelpers'; 

export default function CartPage() {
  const { cartItems, cartTotal, updateQuantity, removeFromCart, clearCart } = useContext(CartContext);
  const { data: siteSettings, loading } = useFirebaseObject("/siteSettings");
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  if (loading) return <Loader />;

  const whatsappNumber = String(siteSettings?.whatsapp || siteSettings?.whatapp || '');
  const cleaned = whatsappNumber.replace(/[^0-9+]/g, '');

  const buildWhatsAppMessage = () => {
    let lines = [
      `Hello, I would like to place an order from ${siteSettings?.siteName || 'your store'}`,
      "",
      "Order details:"
    ];

    cartItems.forEach((item, idx) => {
      const p = item.product || item;
      lines.push(`${idx + 1}. ${p.name} x ${item.quantity} - ₹${p.price}`);
    });

    lines.push("", `Total: ₹${cartTotal}`);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your Cart</h1>
        <div className="text-sm text-neutral-600">{cartItems.length} item(s)</div>
      </div>

      {cartItems.length === 0 ? (
        <div className="card p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
          <p className="text-neutral-600 mb-6">Explore our collections and add items you love.</p>
          <a href="/collections" className="btn btn-secondary">Browse Collections</a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => (
              <div key={item.id} className="card flex items-center gap-4 p-4">
                <img src={normalizeImageUrl(item.product?.images?.[0]) || '/placeholder.jpg'} className="w-28 h-28 object-cover rounded-lg" alt={item.product?.name} />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-lg">{item.product?.name}</div>
                      <div className="text-sm text-neutral-500">{item.product?.variant || ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">₹{item.product?.price}</div>
                      <div className="text-sm text-neutral-500">Subtotal: ₹{(item.product?.price * item.quantity).toFixed(0)}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button aria-label="Decrease quantity" onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="px-3 py-1 rounded-lg border bg-white">-</button>
                      <input type="number" min={1} value={item.quantity} onChange={(e)=>updateQuantity(item.id, Math.max(1, Number(e.target.value)))} className="w-20 text-center border rounded-md p-1" />
                      <button aria-label="Increase quantity" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-3 py-1 rounded-lg border bg-white">+</button>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={()=>removeFromCart(item.id)} className="text-sm text-red-600">Remove</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between">
              <button onClick={confirmClear} className="text-sm text-red-600">Clear cart</button>
              <div className="text-lg font-semibold">Total: ₹{cartTotal}</div>
            </div>
          </div>

          <aside className="card-glass p-6 rounded-lg shadow-md">
            <div className="sticky top-24">
              <h3 className="font-semibold text-lg mb-2">Order Summary</h3>
              <div className="mb-4 text-sm text-neutral-600">Items: {cartItems.length}</div>
              <div className="mb-6 text-2xl font-bold">₹{cartTotal}</div>
              <button onClick={handleCheckout} className="btn btn-accent w-full">Checkout via WhatsApp</button>
              <button onClick={confirmClear} className="mt-3 w-full btn btn-ghost">Clear Cart</button>
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
