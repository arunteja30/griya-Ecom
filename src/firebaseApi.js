import { ref, get, push, set } from 'firebase/database';
import { db } from './firebase';

// Return a promise that resolves to an array of categories: [{ id, ...data }, ...]
export async function getCategories() {
  try {
    const snap = await get(ref(db, 'categories'));
    if (!snap.exists()) return [];
    const val = snap.val();
    return Object.entries(val).map(([key, item]) => ({ id: key, ...item }));
  } catch (err) {
    return Promise.reject(err);
  }
}

// Return a promise that resolves to an array of products in a category
export async function getProductsByCategory(categoryId) {
  try {
    const snap = await get(ref(db, 'products'));
    if (!snap.exists()) return [];
    const val = snap.val();
    const out = [];
    for (const [key, p] of Object.entries(val)) {
      // accept either p.categoryId, p.category or p.categorySlug
      if (
        (p && (p.categoryId === categoryId || p.category === categoryId || p.categorySlug === categoryId)) ||
        key === categoryId
      ) {
        out.push({ id: key, ...p });
      } else if (p && String(p.categoryId) === String(categoryId)) {
        out.push({ id: key, ...p });
      }
    }
    // If no direct matches, try filtering by product.categoryId equals categoryId
    if (out.length === 0) {
      for (const [key, p] of Object.entries(val)) {
        if (p && String(p.categoryId) === String(categoryId)) {
          out.push({ id: key, ...p });
        }
      }
    }
    return out;
  } catch (err) {
    return Promise.reject(err);
  }
}

// Create an order under /orders and return the new key
export async function createOrder(order) {
  try {
    const ordersRef = ref(db, 'orders');
    const newRef = push(ordersRef);
    const orderData = {
      ...order,
      createdAt: order.createdAt || new Date().toISOString()
    };
    await set(newRef, orderData);
    return { key: newRef.key, order: orderData };
  } catch (err) {
    return Promise.reject(err);
  }
}

export default {
  getCategories,
  getProductsByCategory,
  createOrder
};
