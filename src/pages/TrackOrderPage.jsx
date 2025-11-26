import React, { useState, useMemo } from 'react';
import { useFirebaseList } from '../hooks/useFirebase';
import Loader from '../components/Loader';
import SectionTitle from '../components/SectionTitle';
import { showToast } from '../components/Toast';

export default function TrackOrderPage() {
  const { data: ordersRaw, loading } = useFirebaseList('/orders');
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);

  const orders = useMemo(() => {
    if (!ordersRaw) return [];
    if (Array.isArray(ordersRaw)) return ordersRaw.map((o, i) => ({ ...o, _key: String(i) }));
    return Object.entries(ordersRaw).map(([k, v]) => ({ ...v, _key: k }));
  }, [ordersRaw]);

  const result = useMemo(() => {
    if (!searched || !query) return null;
    const q = query.trim();
    return orders.find(o => (o.orderId && String(o.orderId).toLowerCase() === q.toLowerCase()) || o._key === q) || null;
  }, [orders, query, searched]);

  const onSubmit = (e) => {
    e && e.preventDefault();
    setSearched(true);
  };

  if (loading) return <Loader />;

  return (
    <div className="section-container py-8">
      <SectionTitle title="Track your order" subtitle="Enter your order ID to view status" showDecorator={false}/>

      <div className="max-w-2xl mx-auto">
        <form onSubmit={onSubmit} className="flex gap-2 mb-6">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter order id (e.g. order_xyz)"
            className="form-input flex-1"
            aria-label="order-id"
          />
          <button type="submit" className="btn btn-primary">Track</button>
        </form>

        {!searched ? (
          <div className="text-sm text-neutral-600">Enter your order id above and click Track.</div>
        ) : result ? (
          <div className="card p-6 grid grid-cols-1 mb-8 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                    <div className="mt-4">
                <h4 className="font-semibold ">Order Timeline</h4>
                <div className="flex items-center gap-4">
                  {['placed','processing','shipped','delivered'].map((step, idx) => {
                    const done = (result.status || '').toLowerCase() === step || (['shipped','delivered'].includes(result.status || '') && step!=='placed' && step!=='processing' && ['shipped','delivered'].includes(step)) || (result.status || '') === 'paid' && step==='processing';
                    const active = (result.status || '').toLowerCase() === step;
                    return (
                      <div key={step} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${done ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-500'}`}>{idx+1}</div>
                        <div className="text-sm text-neutral-700 capitalize">{step}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
                  <div className="text-sm mt-4 text-neutral-500">Order</div>
                  <div className="text-xl font-semibold">{result.orderId || result._key}</div>
                  <div className="mt-3 flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${result.status === 'paid' ? 'bg-green-100 text-green-700' : result.status === 'shipped' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{(result.status || 'pending').toUpperCase()}</span>
                    {result.tracking?.trackingNumber && (
                      <div className="text-sm text-neutral-600 flex items-center gap-2">
                        <span className="font-medium">Tracking:</span>
                        <span className="bg-neutral-100 px-2 py-1 rounded">{result.tracking.trackingNumber}</span>
                        <button onClick={() => { navigator.clipboard?.writeText(result.tracking.trackingNumber); showToast('Tracking number copied'); }} className="text-xs px-2 py-1 border rounded">Copy</button>
                      </div>
                    )}
                  </div>
                  {result.createdAt && <div className="text-sm text-neutral-500 mt-2">Placed: {new Date(result.createdAt).toLocaleString()}</div>}
                </div>

                
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div>
                  <h4 className="font-semibold mb-2">Shipping Address</h4>
                  {result.shipping ? (
                    <div className="text-sm text-neutral-800">
                      <div>{result.shipping.line1}</div>
                      <div>{result.shipping.city}{result.shipping.state ? `, ${result.shipping.state}` : ''} {result.shipping.pincode || ''}</div>
                    </div>
                  ) : (
                    <div className="text-sm text-neutral-600">No shipping info</div>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Customer</h4>
                  <div className="text-sm">{result.customer?.name || '—'}</div>
                  <div className="text-sm text-neutral-600">{result.customer?.email || '—'}</div>
                  <div className="text-sm text-neutral-600">{result.customer?.phone || '—'}</div>
                </div>
              </div>

              
            </div>

            <aside className="md:col-span-1 mt-24">
              <h4 className="font-semibold mb-3">Items</h4>
              <div className="space-y-3">
                {(result.items || []).map((it, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-neutral-100 rounded overflow-hidden">
                      {it.image ? <img src={it.image} alt={it.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400">No image</div>}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{it.name || it.title || 'Item'}</div>
                      <div className="text-sm text-neutral-600">Qty: {it.quantity || it.qty || 1}</div>
                    </div>
                    <div className="text-sm font-medium">₹{(it.price||0) * (it.quantity || 1)}</div>
                  </div>
                ))}

                <div className="mt-4 border-t pt-3">
                  <div className="flex justify-between text-sm text-neutral-600"><div>Subtotal</div><div>₹{(result.items || []).reduce((s,it)=>s + ((it.price||0) * (it.quantity||1)), 0)}</div></div>
                  <div className="flex justify-between text-sm text-neutral-600 mt-1"><div>Shipping</div><div>₹{result.shipping?.cost ?? 0}</div></div>
                  <div className="flex justify-between text-sm text-neutral-600 mt-1"><div>Discount</div><div>₹{result.discount || 0}</div></div>
                  <div className="flex justify-between text-base font-semibold mt-2"><div>Total</div><div>₹{result.amount || result.total || ( (result.items || []).reduce((s,it)=>s + ((it.price||0) * (it.quantity||1)), 0) + (result.shipping?.cost || 0) - (result.discount || 0) )}</div></div>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <div className="card p-4">
            <div className="text-sm text-red-600">Order not found. Please check the order id and try again.</div>
          </div>
        )}
      </div>
    </div>
  );
}
