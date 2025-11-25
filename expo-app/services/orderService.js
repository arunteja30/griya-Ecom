import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, query, orderByChild, equalTo, onValue, get, update, runTransaction } from 'firebase/database';
import { firebaseConfig } from '../firebaseConfig';

function getDb(){
  if(!getApps().length) initializeApp(firebaseConfig);
  return getDatabase();
}

export const ORDER_STATUSES = {
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  REACHED_STORE: 'REACHED_STORE',
  PICKED_UP: 'PICKED_UP',
  ON_THE_WAY: 'ON_THE_WAY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED'
};

// helper to map snapshot to array and preserve DB key as _key
function snapToArray(snap){
  const val = snap.val();
  if(!val) return [];
  return Object.entries(val).map(([key, data]) => ({ _key: key, ...data }));
}

export function listenToActiveOrdersForRider(riderId, callback){
  if(!riderId) return () => {};
  const db = getDb();
  const q = query(ref(db, 'orders'), orderByChild('riderId'), equalTo(riderId));
  const unsub = onValue(q, snap => {
    try{
      const all = snapToArray(snap);
      const active = all.filter(o => o.status !== ORDER_STATUSES.DELIVERED && o.status !== ORDER_STATUSES.CANCELLED);
      callback(active);
    }catch(e){ console.error('listenToActiveOrdersForRider callback error', e); }
  }, err => { console.error('listenToActiveOrdersForRider error', err); });
  return unsub;
}

export function listenToCompletedOrdersForRider(riderId, callback){
  if(!riderId) return () => {};
  const db = getDb();
  const q = query(ref(db, 'orders'), orderByChild('riderId'), equalTo(riderId));
  const unsub = onValue(q, snap => {
    try{
      const all = snapToArray(snap);
      const completed = all.filter(o => o.status === ORDER_STATUSES.DELIVERED);
      callback(completed);
    }catch(e){ console.error('listenToCompletedOrdersForRider callback error', e); }
  }, err => { console.error('listenToCompletedOrdersForRider error', err); });
  return unsub;
}

export function listenToOrder(orderKey, callback){
  if(!orderKey) return () => {};
  const db = getDb();
  const r = ref(db, `orders/${orderKey}`);
  const unsub = onValue(r, snap => {
    try{ callback(snap.val()); }catch(e){ console.error('listenToOrder callback error', e); }
  }, err => { console.error('listenToOrder error', err); });
  return unsub;
}

export async function getOrderByKey(orderKey){
  if(!orderKey) return null;
  const db = getDb();
  const snap = await get(ref(db, `orders/${orderKey}`));
  return snap.val();
}

export async function getOrder(orderId){
  // fallback: scan orders for matching order.id (order_...)
  if(!orderId) return null;
  const db = getDb();
  const snap = await get(ref(db, 'orders'));
  const val = snap.val();
  if(!val) return null;
  const found = Object.values(val).find(o => o.id === orderId);
  return found || null;
}

// update order status and append to orderStatusHistory (transaction to avoid races)
export async function updateOrderStatus(orderKey, newStatus, extras = {}){
  if(!orderKey) throw new Error('orderKey required');
  const db = getDb();
  const r = ref(db, `orders/${orderKey}`);
  // perform transaction to update status and history atomically
  await runTransaction(r, (current) => {
    if(current === null) return current; // order missing
    const now = Date.now();
    current.status = newStatus;
    current.lastUpdatedAt = now;
    if(extras.assignedAt) current.assignedAt = extras.assignedAt;
    if(extras.deliveredAt) current.deliveredAt = extras.deliveredAt;
    if(!Array.isArray(current.orderStatusHistory)) current.orderStatusHistory = [];
    current.orderStatusHistory.push({ status: newStatus, ts: now });
    return current;
  });
}

export async function acceptOrder(orderKey, riderId){
  if(!orderKey || !riderId) throw new Error('orderKey and riderId required');
  const db = getDb();
  const r = ref(db, `orders/${orderKey}`);
  await runTransaction(r, (current) => {
    if(current === null) return current;
    // prevent accepting if already assigned to someone else and not same rider
    if(current.riderId && current.riderId !== riderId) return current;
    const now = Date.now();
    current.riderId = riderId;
    current.status = ORDER_STATUSES.ACCEPTED;
    current.assignedAt = current.assignedAt || now;
    current.lastUpdatedAt = now;
    if(!Array.isArray(current.orderStatusHistory)) current.orderStatusHistory = [];
    current.orderStatusHistory.push({ status: ORDER_STATUSES.ACCEPTED, ts: now });
    return current;
  });
}

export async function rejectOrder(orderKey, riderId){
  if(!orderKey || !riderId) throw new Error('orderKey and riderId required');
  const db = getDb();
  const r = ref(db, `orders/${orderKey}`);
  await runTransaction(r, (current) => {
    if(current === null) return current;
    // only allow reject if rider is assigned or order unassigned
    const now = Date.now();
    if(current.riderId && current.riderId !== riderId) return current;
    current.riderId = null;
    current.status = ORDER_STATUSES.ASSIGNED; // back to assigned for re-assignment
    current.lastUpdatedAt = now;
    if(!Array.isArray(current.orderStatusHistory)) current.orderStatusHistory = [];
    current.orderStatusHistory.push({ status: 'REJECTED_BY_RIDER', ts: now, by: riderId });
    return current;
  });
}
