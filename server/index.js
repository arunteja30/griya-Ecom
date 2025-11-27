require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Validate env
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

let razorpay = null;
if (!KEY_ID || !KEY_SECRET) {
  console.warn('Razorpay keys not set. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
} else {
  try {
    razorpay = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
  } catch (err) {
    console.error('Failed to initialize Razorpay client', err);
    razorpay = null;
  }
}

app.get('/', (req, res) => {
  if (razorpay) return res.send('Razorpay helper running');
  return res.status(200).send('Razorpay helper running — keys not configured');
});

// Create order endpoint
app.post('/api/razorpay/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt = `rcpt_${Date.now()}`, notes = {} } = req.body || {};

    // Normalize and validate amount (accept rupees or paise)
    const parsed = Number(amount);
    if (!isFinite(parsed) || parsed <= 0) {
      console.warn('create-order: invalid amount received:', amount);
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Heuristic: if integer and >= 1000, assume paise; otherwise treat as rupees
    let amountPaise;
    if (Number.isInteger(parsed) && parsed >= 1000) {
      amountPaise = parsed;
    } else {
      amountPaise = Math.round(parsed * 100);
    }

    console.log('create-order: received amount=', amount, 'normalized paise=', amountPaise);

    if (!razorpay) {
      const useMock = String(process.env.RAZORPAY_MOCK || '').toLowerCase() === 'true';
      if (useMock) {
        const mockOrder = {
          id: `order_mock_${Date.now()}`,
          amount: amountPaise,
          currency,
          receipt,
          status: 'created',
          notes,
          mock: true,
          createdAt: new Date().toISOString()
        };
        console.log('create-order: returning mock order', mockOrder.id);
        return res.json(mockOrder);
      }
      // Helpful response for local/dev when keys are not configured
      return res.status(503).json({ error: 'Razorpay keys not configured on server', amountPaise });
    }

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency,
      receipt,
      notes
    });

    // Echo back normalized amount for easier debugging
    order._normalizedAmountPaise = amountPaise;
    // Add ISO timestamp to returned order so clients can display order date
    try { order.createdAt = new Date().toISOString(); } catch (e) { order.createdAt = null; }
    return res.json(order);
  } catch (err) {
    console.error('create-order error', err);
    return res.status(500).json({ error: err.message || 'Failed to create order' });
  }
});

// Verify payment endpoint - validates signature sent by Razorpay after checkout
app.post('/api/razorpay/verify-payment', async (req, res) => {
  try {
    const body = req.body || {};
    // Razorpay may send keys with different names depending on client
    const razorpayPaymentId = body.razorpay_payment_id || body.payment_id || body.razorpayPaymentId || body.paymentId;
    const razorpayOrderId = body.razorpay_order_id || body.order_id || body.razorpayOrderId || body.orderId;
    const razorpaySignature = body.razorpay_signature || body.signature || body.razorpaySignature || body.signatureValue;

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      console.warn('verify-payment: missing fields', { body });
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    const useMock = String(process.env.RAZORPAY_MOCK || '').toLowerCase() === 'true';
    if (useMock) {
      console.log('verify-payment: mock mode - accepting signature for', razorpayOrderId);
      return res.json({ ok: true, mock: true });
    }

    if (!KEY_SECRET) return res.status(503).json({ error: 'Razorpay secret not configured on server' });

    const hmac = crypto.createHmac('sha256', KEY_SECRET);
    hmac.update(`${razorpayOrderId}|${razorpayPaymentId}`);
    const digest = hmac.digest('hex');

    if (digest === String(razorpaySignature)) {
      return res.json({ ok: true });
    }

    console.warn('verify-payment: signature mismatch', { expected: digest, received: razorpaySignature });
    return res.status(400).json({ ok: false, error: 'Invalid signature' });
  } catch (err) {
    console.error('verify-payment error', err);
    return res.status(500).json({ error: err.message || 'Verification failed' });
  }
});

app.listen(PORT, () => console.log(`Razorpay server listening on http://localhost:${PORT}`));
