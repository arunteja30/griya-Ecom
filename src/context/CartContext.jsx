import React, { createContext, useState, useEffect } from 'react';

export const CartContext = createContext(null);

function getProductId(product) {
  if (!product) return null;
  return product.id || product.slug || product.sku || product.name;
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [appliedPromoKey, setAppliedPromoKey] = useState(null);
  const [appliedPromo, setAppliedPromo] = useState(null);

  const applyPromo = (key, promo) => {
    setAppliedPromoKey(key);
    setAppliedPromo(promo);
  };

  const clearPromo = () => {
    setAppliedPromoKey(null);
    setAppliedPromo(null);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cart');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const normalized = parsed.map((item) => {
            if (!item) return null;
            // Already normalized shape { id, product, quantity }
            if (item.id && item.product) return { ...item, quantity: Number(item.quantity) || 1 };
            // Stored as { product: {...}, quantity }
            if (item.product) {
              const pid = getProductId(item.product) || String(item.product?.id || item.product?.slug || item.product?.sku || item.product?.name || Math.random());
              return { id: pid, product: { ...item.product, id: pid }, quantity: Number(item.quantity) || 1 };
            }
            // Stored as legacy product object directly
            const pid = getProductId(item) || String(item?.id || item?.slug || item?.sku || item?.name || Math.random());
            return { id: pid, product: { ...item, id: pid }, quantity: Number(item.quantity) || 1 };
          }).filter(Boolean);
          setCartItems(normalized);
        }
      }
    } catch (e) {
      setCartItems([]);
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem('cart', JSON.stringify(cartItems)); } catch (e) {}
  }, [cartItems]);

  const addToCart = (product, qty = 1) => {
    const pid = getProductId(product);
    if (!pid) return;
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === pid);
      if (existing) return prev.map((i) => i.id === pid ? { ...i, quantity: i.quantity + qty } : i);
      const productWithId = { ...product, id: pid };
      return [{ id: pid, product: productWithId, quantity: qty }, ...prev];
    });
  };

  const updateQuantity = (productId, quantity) => {
    setCartItems((prev) => prev.map((i) => i.id === productId ? { ...i, quantity: Math.max(1, Number(quantity) || 1) } : i));
  };

  const removeFromCart = (productId) => {
    setCartItems((prev) => prev.filter((i) => i.id !== productId));
  };

  const clearCart = () => {
    setCartItems([]);
    clearPromo();
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + (Number(item.product?.price) || 0) * (Number(item.quantity) || 0), 0);

  return (
    <CartContext.Provider value={{ cartItems, cartTotal, addToCart, updateQuantity, removeFromCart, clearCart, appliedPromo, appliedPromoKey, applyPromo, clearPromo }}>
      {children}
    </CartContext.Provider>
  );
}
