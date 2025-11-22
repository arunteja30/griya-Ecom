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
      <h1 className="text-2xl font-semibold">Your Cart</h1>

      {cartItems.length === 0 ? (
        <div>Your cart is empty</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            {cartItems.map((item) => (
              <div key={item.id} className="flex items-center gap-4 border rounded p-3">
                <img src={normalizeImageUrl(item.product?.images?.[0]) || '/placeholder.jpg'} className="w-24 h-24 object-cover rounded" alt="" />
                <div className="flex-1">
                  <div className="font-medium">{item.product?.name}</div>
                  <div className="text-sm text-gray-600">₹{item.product?.price}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <input type="number" min={1} value={item.quantity} onChange={(e)=>updateQuantity(item.id, Number(e.target.value))} className="w-20 border p-1" />
                    <button onClick={()=>removeFromCart(item.id)} className="text-red-600">Remove</button>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-between items-center">
              <button onClick={confirmClear} className="text-sm text-red-600">Clear cart</button>
              <div className="text-lg font-semibold">Total: ₹{cartTotal}</div>
            </div>
          </div>

          <div className="p-4 border rounded">
            <div className="mb-4">Order Summary</div>
            <div className="mb-4">Total: ₹{cartTotal}</div>
            <button onClick={handleCheckout} className="w-full bg-green-600 text-white py-2 rounded">Checkout via WhatsApp</button>
          </div>
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
