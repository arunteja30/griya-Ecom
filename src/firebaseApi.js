import { ref, push, get, query, orderByChild, equalTo } from 'firebase/database';
import { db } from './firebase';

// Create an order record in Firebase Realtime Database under /orders
export async function createOrder(order) {
  try {
    // Replace undefined with null to avoid Firebase errors
    const safe = JSON.parse(JSON.stringify(order, (_k, v) => (v === undefined ? null : v)));
    const newRef = await push(ref(db, '/orders'), safe);
    return { _id: newRef.key, ...safe };
  } catch (err) {
    console.error('createOrder failed', err);
    throw err;
  }
}

// Verify a payment by checking Firebase entries instead of calling the server directly.
// The function searches common locations where a backend or webhook might write verification
// results: /payments/<paymentId>, /verifications/<paymentId>, and /orders by paymentId or orderId.
// Returns an object: { ok: boolean, source?: string, record?: any }
export async function verifyPayment(payload) {
  try {
    if (!payload || typeof payload !== 'object') throw new Error('Invalid payload');

    const paymentId = payload?.razorpay_payment_id || payload?.payment_id || null;
    const orderId = payload?.razorpay_order_id || payload?.order_id || null;

    // Helper to safe-get a path
    const tryGet = async (path) => {
      try {
        const snap = await get(ref(db, path));
        return snap && snap.exists() ? snap.val() : null;
      } catch (e) {
        console.warn('tryGet failed for', path, e);
        return null;
      }
    };

    // 1) Check /payments/<paymentId>
    if (paymentId) {
      const paymentsNode = await tryGet(`/payments/${paymentId}`);
      if (paymentsNode) {
        const status = paymentsNode?.status || paymentsNode?.verified ? 'paid' : 'unknown';
        const ok = paymentsNode?.verified === true || String(status).toLowerCase() === 'paid';
        return { ok, source: '/payments/' + paymentId, record: paymentsNode };
      }

      const verifNode = await tryGet(`/verifications/${paymentId}`);
      if (verifNode) {
        const ok = verifNode?.ok === true || verifNode?.verified === true || String(verifNode?.status).toLowerCase() === 'paid';
        return { ok, source: '/verifications/' + paymentId, record: verifNode };
      }

      // 2) Search /orders where paymentId matches
      try {
        const q = query(ref(db, '/orders'), orderByChild('paymentId'), equalTo(paymentId));
        const snap = await get(q);
        if (snap && snap.exists()) {
          const val = snap.val();
          // snap.val() is an object map; find first entry
          const firstKey = Object.keys(val)[0];
          const record = val[firstKey];
          const ok = String(record?.status || '').toLowerCase() === 'paid' || record?.paymentId;
          return { ok: !!ok, source: '/orders (by paymentId)', record };
        }
      } catch (e) {
        // If the query fails due to a missing index (common when rules haven't been deployed),
        // silently fall back to the full-scan below. Only warn for other unexpected errors.
        if (e && e.message && /index/i.test(e.message)) {
          // silent fallback to scan
        } else {
          console.warn('query by paymentId failed', e);
        }
      }
    }

    // 3) If orderId provided, search /orders by orderId
    if (orderId) {
      try {
        const q2 = query(ref(db, '/orders'), orderByChild('orderId'), equalTo(orderId));
        const snap2 = await get(q2);
        if (snap2 && snap2.exists()) {
          const val = snap2.val();
          const firstKey = Object.keys(val)[0];
          const record = val[firstKey];
          const ok = String(record?.status || '').toLowerCase() === 'paid' || record?.paymentId;
          return { ok: !!ok, source: '/orders (by orderId)', record };
        }
      } catch (e) {
        if (e && e.message && /index/i.test(e.message)) {
          // silent fallback to scan
        } else {
          console.warn('query by orderId failed', e);
        }
      }
    }

    // 4) As a last resort, scan /orders for a match using payment/order fields (limited fallback)
    try {
      const snapAll = await get(ref(db, '/orders'));
      if (snapAll && snapAll.exists()) {
        const all = snapAll.val();
        for (const k of Object.keys(all)) {
          const rec = all[k];
          if (paymentId && (rec.paymentId === paymentId || rec.payment?.razorpayPaymentId === paymentId)) {
            const ok = String(rec?.status || '').toLowerCase() === 'paid';
            return { ok: !!ok, source: '/orders (scan by paymentId)', record: rec };
          }
          if (orderId && (rec.orderId === orderId || rec.order?.razorpayOrderId === orderId)) {
            const ok = String(rec?.status || '').toLowerCase() === 'paid';
            return { ok: !!ok, source: '/orders (scan by orderId)', record: rec };
          }
        }
      }
    } catch (e) {
      console.warn('full orders scan failed', e);
    }

    // Not found or not verified
    return { ok: false, source: 'not_found' };
  } catch (err) {
    console.error('verifyPayment (firebase) failed', err);
    throw err;
  }
}
