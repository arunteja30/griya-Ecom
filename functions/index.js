const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// Cloud Function to send push notification to a rider when an order is assigned to them.
exports.onOrderAssigned = functions.database.ref('/orders/{orderKey}/riderId')
  .onUpdate(async (change, context) => {
    const before = change.before.val();
    const after = change.after.val();
    const orderKey = context.params.orderKey;

    // only send when riderId becomes a non-null value and changed
    if(before === after) return null;
    if(!after) return null; // unassigned

    const riderId = after;

    try{
      // fetch push token for rider
      const tokenSnap = await admin.database().ref(`/riderPushTokens/${riderId}/token`).get();
      const token = tokenSnap.val();
      if(!token) return null;

      // fetch order details for notification body
      const orderSnap = await admin.database().ref(`/orders/${orderKey}`).get();
      const order = orderSnap.val() || {};
      const title = 'New Delivery Assigned';
      const body = `Order ${order.id || orderKey} assigned. Pickup: ${order.pickupAddress || ''}`;

      // build message for Expo push service
      const message = {
        to: token,
        sound: 'default',
        title,
        body,
        data: { orderKey }
      };

      // send via Expo push endpoint using admin SDK's fetch (node fetch required)
      const fetch = require('node-fetch');
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([message])
      });

      const json = await res.json();
      console.log('expo push response', json);
      return null;
    }catch(err){
      console.error('onOrderAssigned error', err);
      return null;
    }
  });
