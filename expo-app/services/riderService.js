import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, get, update, onValue } from 'firebase/database';
import { firebaseConfig } from '../firebaseConfig';

function getDb(){
  if(!getApps().length) initializeApp(firebaseConfig);
  return getDatabase();
}

export async function getRiderProfile(uid){
  if(!uid) return null;
  const db = getDb();
  const snap = await get(ref(db, `riders/${uid}`));
  return snap.val();
}

export function listenToRiderProfile(uid, callback){
  if(!uid) return () => {};
  const db = getDb();
  const r = ref(db, `riders/${uid}`);
  const unsub = onValue(r, snap => {
    try{ callback(snap.val()); }catch(e){ console.error(e); }
  }, err => { console.error('listenToRiderProfile error', err); });
  return unsub;
}

export async function updateRiderStatus(uid, { isOnline }){
  if(!uid) return;
  const db = getDb();
  const payload = { isOnline: !!isOnline, lastSeenAt: Date.now() };
  await update(ref(db, `riders/${uid}`), payload);
}
