import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, update } from 'firebase/database';
import { firebaseConfig } from '../firebaseConfig';

let watcher = null;
let intervalId = null;

function getDb(){
  if(!getApps().length) initializeApp(firebaseConfig);
  return getDatabase();
}

export async function startLocationTracking(riderId, orderId, onError){
  if(!riderId) throw new Error('riderId required');
  try{
    // Dynamically import expo-location so web builds (Vite) don't fail
    let LocationModule;
    try{
      LocationModule = await import('expo-location');
    }catch(e){
      console.warn('expo-location not available in this environment. Location tracking disabled.');
      return false;
    }

    const Location = LocationModule.default || LocationModule;
    const { requestForegroundPermissionsAsync, getCurrentPositionAsync, Accuracy } = Location;

    const { status } = await requestForegroundPermissionsAsync();
    if(status !== 'granted'){
      throw new Error('Location permission not granted');
    }

    const db = getDb();
    const sendLocation = async () => {
      try{
        const loc = await getCurrentPositionAsync({ accuracy: Accuracy.Highest });
        const payload = { lat: loc.coords.latitude, lng: loc.coords.longitude, ts: Date.now() };
        if(orderId){
          await update(ref(db, `orders/${orderId}/currentRiderLocation`), payload);
        }
        await update(ref(db, `riderLocations/${riderId}`), payload);
      }catch(e){
        console.error('sendLocation error', e);
        if(onError) onError(e);
      }
    };
    // run immediately
    await sendLocation();
    // then every 20 seconds
    intervalId = setInterval(sendLocation, 20000);
    return true;
  }catch(e){
    console.error('startLocationTracking failed', e);
    if(onError) onError(e);
    return false;
  }
}

export function stopLocationTracking(){
  try{
    if(intervalId){ clearInterval(intervalId); intervalId = null; }
    if(watcher && typeof watcher.remove === 'function'){ watcher.remove(); watcher = null; }
  }catch(e){ console.error('stopLocationTracking', e); }
}
