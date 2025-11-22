import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, update } from 'firebase/database';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { showToast } from '../../components/Toast';

export default function OrdersAdmin(){
  const [orders, setOrders] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(()=>{
    const r = ref(db, '/orders');
    return onValue(r, snap=>{
      setOrders(snap.val() || {});
      setLoading(false);
    });
  },[]);

  const updateStatus = async (id, status)=>{
    try{
      await update(ref(db, `/orders/${id}`), { status });
      showToast('Order updated');
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

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Orders</h2>

      {items.length === 0 ? (
        <div className="card p-6 text-center">No orders found</div>
      ) : (
        <div className="space-y-3">
          {items.map(([id, o])=> (
            <div key={id} className="border p-4 rounded flex items-start justify-between">
              <div>
                <div className="font-medium">{o.customer?.name || '—'} • <span className="text-sm text-neutral-500">{o.customer?.phone || ''}</span></div>
                <div className="text-sm text-neutral-600">Order: {o.orderId || id} • {o.items?.length || 0} item(s)</div>
                <div className="text-sm text-neutral-500">{o.shipping?.city || ''}, {o.shipping?.state || ''} • {o.pincode || o.shipping?.pincode || ''}</div>

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
                <div className="text-lg font-semibold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(o.amount || 0)}</div>
                <div className={`px-3 py-1 rounded text-sm ${o.status === 'paid' ? 'bg-green-100 text-green-700' : o.status === 'shipped' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{o.status || 'pending'}</div>
                <div className="flex gap-2">
                  <button onClick={()=>setSelected({ id, data: o })} className="text-sm text-primary-700">View</button>
                  {o.status !== 'shipped' && <button onClick={()=>updateStatus(id, 'shipped')} className="text-sm text-green-700">Mark Shipped</button>}
                  {o.status !== 'cancelled' && <button onClick={()=>updateStatus(id, 'cancelled')} className="text-sm text-red-600">Cancel</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!selected} hideActions onClose={()=>setSelected(null)} title={selected ? `Order ${selected.id}` : ''}>
        {selected && (
          <div>
            <div className="mb-3">
              <div className="font-semibold">Customer</div>
              <div>{selected.data.customer?.name} • {selected.data.customer?.email} • {selected.data.customer?.phone}</div>
            </div>
            <div className="mb-3">
              <div className="font-semibold">Shipping</div>
              <div>{selected.data.shipping?.line1}</div>
              <div>{selected.data.shipping?.city}, {selected.data.shipping?.state} - {selected.data.shipping?.pincode}</div>
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
                      <div className="text-sm text-neutral-600">Qty: {it.quantity} • ₹{it.price}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={()=>setSelected(null)} className="px-4 py-2">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
