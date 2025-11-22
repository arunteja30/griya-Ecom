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

  const options = {
    key,
    amount: String(Math.round(amountINR * 100)), // INR -> paise
    currency: 'INR',
    name: name || 'Store',
    description: description || 'Order Payment',
    image: '',
    handler: function (response) {
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
    if (onFailure) onFailure(response);
  });
  rzp.open();
}

export async function createOrderOnServer(amountPaise) {
  const res = await fetch((import.meta.env.VITE_API_BASE || '') + '/api/razorpay/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise })
  });
  if (!res.ok) throw new Error('Failed to create order');
  return res.json();
}
