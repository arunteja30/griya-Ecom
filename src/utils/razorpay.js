// Lightweight Razorpay helper
export function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Razorpay SDK failed to load'));
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout({ key, amountINR, name, description, prefill = {}, orderId, onSuccess, onFailure }) {
  // Ensure SDK is loaded (propagate load errors)
  await loadRazorpayScript().catch(err => {
    console.error('Razorpay script failed to load', err);
    throw err;
  });

  if (!window.Razorpay) throw new Error('Razorpay SDK not available');

  // Normalize and validate amount (INR -> paise). Ensure at least 1 paise.
  const amountPaise = Math.max(1, Math.round(Number(amountINR ?? 0) * 100));

  const options = {
    key,
    amount: String(amountPaise),
    currency: 'INR',
    name: name || 'Store',
    description: description || 'Order Payment',
    ...(orderId ? { order_id: orderId } : {}),
    handler: (response) => onSuccess?.(response),
    prefill,
    theme: { color: '#2874F0' }
  };

  try {
    const rzp = new window.Razorpay(options);
    if (typeof rzp.on === 'function') {
      rzp.on('payment.failed', (response) => {
        onFailure?.(response);
        rzp.close();
      });
    }
    rzp.open();
    return rzp;
  } catch (err) {
    console.error('Failed to open Razorpay checkout', err);
    throw err;
  }
}

export async function createOrderOnServer(amountPaise) {
  const base = import.meta.env.VITE_API_BASE || '';
  // If no API base is configured, return a fallback allowing client-side testing
  if (!base) {
    return { key: import.meta.env.VITE_RAZORPAY_KEY || null };
  }

  try {
    const res = await fetch(base + '/api/razorpay/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountPaise })
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn('createOrderOnServer: server responded with non-OK:', res.status, txt);
      return { key: import.meta.env.VITE_RAZORPAY_KEY || null };
    }

    return await res.json();
  } catch (err) {
    console.warn('createOrderOnServer: request failed, falling back to client key', err);
    return { key: import.meta.env.VITE_RAZORPAY_KEY || null };
  }
}