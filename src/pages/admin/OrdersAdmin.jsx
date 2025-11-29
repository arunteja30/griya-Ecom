import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../firebase';
import { ref, onValue, update, get, remove } from 'firebase/database';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { showToast } from '../../components/Toast';
import { useFirebaseObject } from '../../hooks/useFirebase';

export default function OrdersAdmin(){
  const [orders, setOrders] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  // filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // helper to parse createdAt which may be ISO string or numeric timestamp
  const parseTs = (val) => {
    if (!val && val !== 0) return null;
    const num = Number(val);
    if (!isNaN(num) && num > 0) return num;
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.getTime();
    return null;
  };

  // compute orders in the last 7 days for quick stats
  const last7Count = useMemo(() => {
    const now = Date.now();
    const sevenAgo = now - 7 * 24 * 60 * 60 * 1000;
    return Object.values(orders || {}).filter(o => {
      const ts = parseTs(o?.createdAt);
      return ts && ts >= sevenAgo;
    }).length;
  }, [orders]);

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

  const deleteOrder = async (id) => {
    try {
      if (!id) return;
      await remove(ref(db, `/orders/${id}`));
      showToast('Order deleted', 'success');
      // close any open modals related to this order
      if (selected && selected.id === id) setSelected(null);
      setDeleteCandidate(null);
    } catch (e) {
      console.error('Failed to delete order', e);
      showToast('Failed to delete order', 'error');
    }
  };

  if(loading) return <Loader />;

  // prepare, sort and filter orders for display
  const itemsSorted = Object.entries(orders).sort((a,b)=>{
    const da = new Date(a[1].createdAt || 0).getTime();
    const dbt = new Date(b[1].createdAt || 0).getTime();
    return dbt - da;
  });

  const items = itemsSorted.filter(([id, o]) => {
    // status
    if(statusFilter && (o.status || '') !== statusFilter) return false;

    // date range filter
    if(fromDate || toDate){
      const ts = parseTs(o?.createdAt);
      if(!ts) return false;
      const fromTs = fromDate ? new Date(fromDate).setHours(0,0,0,0) : -Infinity;
      const toTs = toDate ? new Date(toDate).setHours(23,59,59,999) : Infinity;
      if(ts < fromTs || ts > toTs) return false;
    }

    if(search){
      const q = String(search).trim().toLowerCase();
      const orderIdMatch = String(o.orderId || id).toLowerCase().includes(q);
      const customerName = String(o.customer?.name || o.address?.name || '').toLowerCase();
      const customerPhone = String(o.customer?.phone || o.customer?.contact || o.address?.phone || o.address?.contact || '').toLowerCase();
      const itemsText = (o.items || []).map(it => (it.name || it.title || it.id || it.productId || '')).join(' ').toLowerCase();
      if(orderIdMatch || customerName.includes(q) || customerPhone.includes(q) || itemsText.includes(q)) return true;
      return false;
    }
    return true;
  });

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Orders <span className="text-sm text-neutral-500">(Last 7 days: {last7Count})</span></h2>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-2">
        <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search order id, customer, phone or item" className="border p-2 rounded w-1/3" />
        <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} className="border p-2 rounded">
          <option value="">All status</option>
          <option value="pending">pending</option>
          <option value="paid">paid</option>
          <option value="shipped">shipped</option>
          <option value="delivered">delivered</option>
          <option value="cancelled">cancelled</option>
        </select>

        {/* Date range filter */}
        <div className="flex items-center gap-2">
          <input type="date" value={fromDate} onChange={(e)=>setFromDate(e.target.value)} className="border p-2 rounded" />
          <input type="date" value={toDate} onChange={(e)=>setToDate(e.target.value)} className="border p-2 rounded" />
          <button onClick={()=>{
            // set to last 7 days
            const to = new Date();
            const from = new Date(); from.setDate(from.getDate() - 6);
            setFromDate(from.toISOString().slice(0,10));
            setToDate(to.toISOString().slice(0,10));
          }} className="border p-2 rounded text-sm">Last 7 days</button>
        </div>

        <button onClick={()=>{setSearch(''); setStatusFilter(''); setFromDate(''); setToDate('');}} className="ml-auto text-sm text-neutral-600">Clear</button>
      </div>

      {items.length === 0 ? (
        <div className="card p-6 text-center">No orders found</div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(([id, o])=> {
            const customer = o.customer || o.address || {};
            const shipping = o.shipping || o.address || {};
            const amount = o.amount ?? o.total ?? (o.items ? o.items.reduce((s,it)=>s + ((it.price||0)*(it.quantity||1)), 0) : 0);
            const status = o.status || 'pending';

            return (
              <div key={id} className="border p-4 rounded flex flex-col justify-between h-full bg-white shadow-sm">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{customer?.name || '—'}</div>
                      <div className="text-sm text-neutral-500">{customer?.phone || customer?.contact || ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{fmt(amount)}</div>
                      <div className={`px-2 py-1 rounded text-sm mt-2 ${status === 'paid' || status === 'delivered' ? 'bg-green-100 text-green-700' : status === 'shipped' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{status}</div>
                    </div>
                  </div>

                  <div className="text-sm text-neutral-600 mt-2">Order: {o.orderId || id} • {o.items?.length || 0} item(s)</div>
                  <div className="text-sm text-neutral-500">{shipping?.city || ''}{shipping?.state ? ', ' + shipping.state : ''} • {shipping?.pincode || ''}</div>
                  <div className="text-sm text-neutral-400 mt-1">{o.createdAt ? new Date(parseTs(o.createdAt)).toLocaleString() : '—'}</div>

                  {o.items && o.items.length > 0 && (
                    <div className="mt-3 flex items-center gap-3">
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

                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <button onClick={()=>setSelected({ id, data: o })} className="text-sm text-primary-700">View</button>

                    {status === 'shipped' ? (
                      status !== 'delivered' && (
                        <button onClick={()=>updateStatus(id, 'delivered')} className="text-sm text-blue-700">Mark Delivered</button>
                      )
                    ) : (
                      status !== 'shipped' && <button onClick={()=>updateStatus(id, 'shipped')} className="text-sm text-green-700">Mark Shipped</button>
                    )}

                    {status !== 'paid' && <button onClick={()=>updateStatus(id, 'paid')} className="text-sm text-indigo-700">Mark Paid</button>}
                    {status !== 'cancelled' && <button onClick={()=>updateStatus(id, 'cancelled')} className="text-sm text-red-600">Cancel</button>}
                    <button onClick={()=>setDeleteCandidate({ id, data: o })} className="text-sm text-red-600">Delete</button>
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

      {/* Delete confirmation modal */}
      <Modal isOpen={!!deleteCandidate} onClose={()=>setDeleteCandidate(null)} title="Delete Order" hideActions>
        {deleteCandidate && (
          <div>
            <p>Are you sure you want to permanently delete order <strong>{deleteCandidate?.data?.orderId || deleteCandidate?.id}</strong> ? This action cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={()=>setDeleteCandidate(null)} className="px-4 py-2">Cancel</button>
              <button onClick={async ()=>{ await deleteOrder(deleteCandidate.id); }} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
