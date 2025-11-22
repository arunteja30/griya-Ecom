import React, { createContext, useState, useEffect } from 'react';

export const CartContext = createContext(null);

function getProductId(product) {
  if (!product) return null;
  return product.id || product.slug || product.sku || product.name;
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cart');
      if (raw) setCartItems(JSON.parse(raw));
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

  const clearCart = () => setCartItems([]);

  const cartTotal = cartItems.reduce((sum, item) => sum + (item.product?.price || 0) * (item.quantity || 0), 0);

  return (
    <CartContext.Provider value={{ cartItems, cartTotal, addToCart, updateQuantity, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}
