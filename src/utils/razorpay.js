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
  await loadRazorpayScript();

  // Defensive cleanup for leftover Razorpay UI elements
  const cleanupRazorpayUi = () => {
    try {
      // remove overlay elements and checkout iframe if present
      const selectors = ['.razorpay-overlay', 'iframe[id^="razorpay"]', '#razorpay-checkout-frame'];
      selectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach(el => el.remove());
      });
      // restore body scrolling if it was disabled
      try { document.body.style.overflow = ''; } catch (e) { /* ignore */ }
    } catch (e) { /* ignore cleanup errors */ }
  };

  const options = {
    key,
    amount: String(Math.round(amountINR * 100)), // INR -> paise
    currency: 'INR',
    name: name || 'Store',
    description: description || 'Order Payment',
    image: '',
    handler: function (response) {
      // ensure checkout UI is closed on success
      try { if (typeof rzp !== 'undefined' && rzp && typeof rzp.close === 'function') rzp.close(); } catch (e) { }
      cleanupRazorpayUi();
      if (onSuccess) onSuccess(response);
    },
    prefill: prefill,
    theme: {
      color: '#2874F0'
    }
  };

  if (orderId) options.order_id = orderId;

  const rzp = new window.Razorpay(options);
  rzp.on('payment.failed', function (response) {
    // Ensure checkout UI is closed and UI cleaned up before invoking failure handler
    try { if (typeof rzp.close === 'function') rzp.close(); } catch (e) { /* ignore */ }
    cleanupRazorpayUi();
    if (onFailure) onFailure(response);
  });
  // Open checkout
  rzp.open();
}

export async function createOrderOnServer(amountInput) {
  // Determine API base (support both VITE_API_BASE and VITE_RAZORPAY_SERVER_URL)
  const apiBase = (import.meta.env.VITE_API_BASE || import.meta.env.VITE_RAZORPAY_SERVER_URL || 'http://localhost:4000').replace(/\/$/, '');

  // If no API base configured and environment omitted, still allow quick local testing by returning public key
  if (!apiBase) {
    return { key: import.meta.env.VITE_RAZORPAY_KEY };
  }

  // Normalize input: accept number (assumed INR by default) or object { amount, unit }
  let amount = null;
  let unit = null; // 'inr' or 'paise'

  if (amountInput != null && typeof amountInput === 'object' && !Array.isArray(amountInput)) {
    if (amountInput.amount == null) throw new Error('Invalid amount object');
    amount = Number(amountInput.amount);
    unit = String(amountInput.unit || '').toLowerCase();
  } else {
    amount = Number(amountInput);
  }

  if (!isFinite(amount) || amount <= 0) throw new Error('Invalid amount');

  // Convert to paise
  let amountPaise;
  if (unit === 'paise' || unit === 'p') {
    amountPaise = Math.round(amount);
  } else if (unit === 'inr' || unit === 'rs' || unit === '₹') {
    amountPaise = Math.round(amount * 100);
  } else {
    // Heuristic: if integer and looks large (>=1000) assume paise, else treat as INR
    if (Number.isInteger(amount) && amount >= 1000) {
      amountPaise = Math.round(amount);
    } else {
      amountPaise = Math.round(amount * 100);
    }
  }

  console.log('[razorpay] createOrderOnServer: amountInput=', amountInput, 'normalized paise=', amountPaise);

  const res = await fetch(`${apiBase}/api/razorpay/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error('Failed to create order: ' + (txt || res.status));
  }

  return res.json();
}