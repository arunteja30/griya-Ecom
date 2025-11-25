import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, remove } from 'firebase/database';
import { firebaseConfig } from '../firebaseConfig';

function getDb(){
  if(!getApps().length) initializeApp(firebaseConfig);
  return getDatabase();
}

// Request permissions and register for Expo push notifications.
export async function registerForPushNotificationsAsync(uid){
  if(!uid) return null;
  try{
    const settings = await Notifications.getPermissionsAsync();
    let finalStatus = settings.status;
    if(finalStatus !== 'granted'){
      const request = await Notifications.requestPermissionsAsync();
      finalStatus = request.status;
    }
    if(finalStatus !== 'granted'){
      console.warn('Push notifications permission not granted');
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    const token = tokenResponse.data;

    // Save token to realtime database under riderPushTokens/{uid}
    const db = getDb();
    await set(ref(db, `riderPushTokens/${uid}`), { token, platform: Constants.platform ? Constants.platform.ios ? 'ios' : 'android' : 'unknown', ts: Date.now() });

    return token;
  }catch(e){
    console.error('registerForPushNotificationsAsync error', e);
    return null;
  }
}

export async function unregisterPushTokenForUid(uid){
  if(!uid) return;
  try{
    const db = getDb();
    await remove(ref(db, `riderPushTokens/${uid}`));
  }catch(e){ console.error('unregisterPushTokenForUid error', e); }
}

// Helper to listen to incoming notifications while app is foreground
export function addForegroundNotificationListener(handler){
  return Notifications.addNotificationReceivedListener(handler);
}

export function addNotificationResponseListener(handler){
  return Notifications.addNotificationResponseReceivedListener(handler);
}
