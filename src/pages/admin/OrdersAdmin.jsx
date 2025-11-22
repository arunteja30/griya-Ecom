import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, update, get } from 'firebase/database';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { showToast } from '../../components/Toast';
import { useFirebaseObject } from '../../hooks/useFirebase';

export default function OrdersAdmin(){
  const [orders, setOrders] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const { data: siteSettings } = useFirebaseObject('/siteSettings');

  useEffect(()=>{
    const r = ref(db, '/orders');
    return onValue(r, snap=>{
      setOrders(snap.val() || {});
      setLoading(false);
    });
  },[]);

  const updateStatus = async (id, status)=>{
    try{
      // Update status in database first
      await update(ref(db, `/orders/${id}`), { status });
      showToast('Order updated');

      // Read fresh order data after update
      const snap = await get(ref(db, `/orders/${id}`));
      const o = snap.exists() ? snap.val() : (orders[id] || {});

      // Send WhatsApp notification for important status changes
      if(status === 'shipped' || status === 'cancelled'){
        const customerPhone = o.customer?.phone || o.customer?.contact || o.address?.phone || o.address?.contact || o.phone;
        const customerName = o.customer?.name || o.address?.name || '';

        if(customerPhone){
          let cleaned = String(customerPhone).replace(/\D/g, '');
          // assume Indian numbers when 10 digits
          if(cleaned.length === 10) cleaned = '91' + cleaned;
          // drop leading zeros
          cleaned = cleaned.replace(/^0+/, '');

          const brand = siteSettings?.brandName || 'Store';
          const msgLines = [];
          msgLines.push(`Hello ${customerName || ''},`);

          if(status === 'shipped'){
            msgLines.push(`Your order ${o.orderId || id} from ${brand} has been shipped.`);
            if(o.tracking) msgLines.push(`Tracking: ${o.tracking}`);
            const amt = o.amount ?? o.total ?? (o.items ? o.items.reduce((s,it)=>s + ((it.price||0)*(it.quantity||1)), 0) : 0);
            msgLines.push(`Total: ₹${amt}`);
            msgLines.push('You can reply to this chat for support. Thank you!');
          } else {
            msgLines.push(`We're sorry. Your order ${o.orderId || id} from ${brand} has been cancelled.`);
            msgLines.push('If you paid, we will initiate a refund. Reply to this chat for assistance.');
          }

          const text = encodeURIComponent(msgLines.join('\n'));
          const url = `https://wa.me/${cleaned}?text=${text}`;
          window.open(url, '_blank');
        } else {
          showToast('Customer phone not found — cannot open WhatsApp', 'warning');
        }
      }

    }catch(e){
      console.error(e);
      showToast('Failed to update order', 'error');
    }
  };

  if(loading) return <Loader />;

  const items = Object.entries(orders).sort((a,b)=>{
    const da = new Date(a[1].createdAt || 0).getTime();
    const dbt = new Date(b[1].createdAt || 0).getTime();
    return dbt - da;
  });

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Orders</h2>

      {items.length === 0 ? (
        <div className="card p-6 text-center">No orders found</div>
      ) : (
        <div className="space-y-3">
          {items.map(([id, o])=> {
            const customer = o.customer || o.address || {};
            const shipping = o.shipping || o.address || {};
            const amount = o.amount ?? o.total ?? (o.items ? o.items.reduce((s,it)=>s + ((it.price||0)*(it.quantity||1)), 0) : 0);
            const status = o.status || 'pending';

            return (
              <div key={id} className="border p-4 rounded flex items-start justify-between">
                <div>
                  <div className="font-medium">{customer?.name || '—'} • <span className="text-sm text-neutral-500">{customer?.phone || customer?.contact || ''}</span></div>
                  <div className="text-sm text-neutral-600">Order: {o.orderId || id} • {o.items?.length || 0} item(s)</div>
                  <div className="text-sm text-neutral-500">{shipping?.city || ''}{shipping?.state ? ', ' + shipping.state : ''} • {shipping?.pincode || ''}</div>

                  {o.items && o.items.length > 0 && (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex -space-x-2">
                        {o.items.slice(0,3).map((it, idx) => (
                          <div key={idx} className="w-10 h-10 rounded overflow-hidden border bg-white">
                            {it.image ? <img src={it.image} alt={it.name || 'item'} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs text-neutral-500">No image</div>}
                          </div>
                        ))}
                      </div>
                      <div className="text-sm text-neutral-600">
                        {o.items.slice(0,3).map(it => {
                          const pid = it.id || it.productId || it.sku || '—';
                          const name = it.name || it.title || 'Item';
                          const qty = it.quantity ?? it.qty ?? 1;
                          return `${name} (${pid}) x${qty}`;
                        }).join(', ')}{o.items.length > 3 ? ` and ${o.items.length - 3} more` : ''}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="text-lg font-semibold">{fmt(amount)}</div>
                  <div className={`px-3 py-1 rounded text-sm ${status === 'paid' || status === 'delivered' ? 'bg-green-100 text-green-700' : status === 'shipped' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{status}</div>
                  <div className="flex gap-2">
                    <button onClick={()=>setSelected({ id, data: o })} className="text-sm text-primary-700">View</button>

                    {status === 'shipped' ? (
                      // when shipped, allow marking as delivered (unless already delivered)
                      status !== 'delivered' && (
                        <button onClick={()=>updateStatus(id, 'delivered')} className="text-sm text-blue-700">Mark Delivered</button>
                      )
                    ) : (
                      // otherwise allow marking as shipped
                      status !== 'shipped' && <button onClick={()=>updateStatus(id, 'shipped')} className="text-sm text-green-700">Mark Shipped</button>
                    )}

                    {status !== 'paid' && <button onClick={()=>updateStatus(id, 'paid')} className="text-sm text-indigo-700">Mark Paid</button>}
                    {status !== 'cancelled' && <button onClick={()=>updateStatus(id, 'cancelled')} className="text-sm text-red-600">Cancel</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={!!selected} hideActions onClose={()=>setSelected(null)} title={selected ? `Order ${selected.id}` : ''}>
        {selected && (
          <div>
            <div className="mb-3">
              <div className="font-semibold">Customer</div>
              <div>{(selected.data.customer?.name || selected.data.address?.name) || '—'} • {selected.data.customer?.email || selected.data.address?.email || ''} • {selected.data.customer?.phone || selected.data.address?.phone}</div>
            </div>

            <div className="mb-3">
              <div className="font-semibold">Shipping</div>
              <div>{selected.data.shipping?.line1 || selected.data.address?.line1}</div>
              <div>{selected.data.shipping?.city || selected.data.address?.city}, {selected.data.shipping?.state || selected.data.address?.state} - {selected.data.shipping?.pincode || selected.data.address?.pincode}</div>
            </div>

            <div className="mb-3">
              <div className="font-semibold">Items</div>
              <div className="space-y-2">
                {(selected.data.items || []).map((it, idx)=> (
                  <div key={idx} className="flex items-center gap-3">
                    {it.image && <img src={it.image} alt="" className="w-12 h-12 object-cover rounded" />}
                    <div>
                      <div className="font-medium">{it.name}</div>
                      <div className="text-sm text-neutral-500">Product #: {it.id || it.productId || it.sku || '—'}</div>
                      <div className="text-sm text-neutral-600">Qty: {it.quantity || it.qty || 1} • ₹{it.price}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selected.data.payment && (
              <div className="mb-3">
                <div className="font-semibold">Payment</div>
                <div className="text-sm">Payment ID: {selected.data.payment?.razorpayPaymentId || selected.data.payment?.paymentId || '—'}</div>
                <div className="text-sm">Order ID: {selected.data.payment?.razorpayOrderId || selected.data.payment?.orderId || '—'}</div>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={()=>setSelected(null)} className="px-4 py-2">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
