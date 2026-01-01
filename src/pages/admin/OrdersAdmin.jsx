import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, update, get } from 'firebase/database';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { showToast } from '../../components/Toast';
import { useFirebaseObject } from '../../hooks/useFirebase';
import AdminCard from './AdminCard';

export default function OrdersAdmin(){
  const [orders, setOrders] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  // filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // all | today | last7 | last30 | thisMonth | custom
  const [customStart, setCustomStart] = useState(''); // yyyy-mm-dd
  const [customEnd, setCustomEnd] = useState('');
   const [viewMode, setViewMode] = useState('list');

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

   // prepare, sort and filter orders for display
   const itemsSorted = Object.entries(orders).sort((a,b)=>{
     const da = new Date(a[1].createdAt || 0).getTime();
     const dbt = new Date(b[1].createdAt || 0).getTime();
     return dbt - da;
   });

   const isInDateRange = (o) => {
     if(!dateFilter || dateFilter === 'all') return true;
     const created = o.createdAt;
     if(!created) return false;
     const createdTs = (typeof created === 'number') ? created : (new Date(created)).getTime();
     if(isNaN(createdTs) || createdTs <= 0) return false;

     const now = Date.now();
     let startTs = 0;
     let endTs = now;

     if(dateFilter === 'today'){
       const d = new Date(); d.setHours(0,0,0,0); startTs = d.getTime();
     } else if(dateFilter === 'last7'){
       startTs = now - 7 * 24 * 60 * 60 * 1000;
     } else if(dateFilter === 'last30'){
       startTs = now - 30 * 24 * 60 * 60 * 1000;
     } else if(dateFilter === 'thisMonth'){
       const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); startTs = d.getTime();
     } else if(dateFilter === 'custom'){
       if(!customStart && !customEnd) return true;
       if(customStart){ const s = new Date(customStart); s.setHours(0,0,0,0); startTs = s.getTime(); }
       if(customEnd){ const e = new Date(customEnd); e.setHours(23,59,59,999); endTs = e.getTime(); }
     }

     return createdTs >= startTs && createdTs <= endTs;
   };

   const items = itemsSorted.filter(([id, o]) => {
     if(statusFilter && (o.status || '') !== statusFilter) return false;
     if(search){
       const q = String(search).trim().toLowerCase();
       const orderIdMatch = String(o.orderId || id).toLowerCase().includes(q);
       const customerName = String(o.customer?.name || o.address?.name || '').toLowerCase();
       const customerPhone = String(o.customer?.phone || o.customer?.contact || o.address?.phone || o.address?.contact || '').toLowerCase();
       const itemsText = (o.items || []).map(it => (it.name || it.title || it.id || it.productId || '')).join(' ').toLowerCase();
       if(orderIdMatch || customerName.includes(q) || customerPhone.includes(q) || itemsText.includes(q)) return true;
       return false;
     }
    // date filter
    if(!isInDateRange(o)) return false;
     return true;
   });

   const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

   return (
     <AdminCard title="Orders Management" subtitle="Track and manage customer orders efficiently">
       {/* Enhanced Filters Section */}
       <div className="mb-6 p-4 bg-gray-50 rounded-xl border">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
           <div className="md:col-span-2">
             <label className="block text-sm font-medium text-gray-700 mb-1">Search Orders</label>
             <div className="relative">
               <input 
                 value={search} 
                 onChange={(e)=>setSearch(e.target.value)} 
                 placeholder="Order ID, customer name, phone..." 
                 className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
               />
               <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
               </svg>
             </div>
           </div>
           
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
             <select 
               value={statusFilter} 
               onChange={(e)=>setStatusFilter(e.target.value)} 
               className="w-full py-2.5 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
             >
               <option value="">All Status</option>
               <option value="pending">Pending</option>
               <option value="paid">Paid</option>
               <option value="shipped">Shipped</option>
               <option value="delivered">Delivered</option>
               <option value="cancelled">Cancelled</option>
             </select>
           </div>
           
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
             <select 
               value={dateFilter} 
               onChange={(e)=>setDateFilter(e.target.value)} 
               className="w-full py-2.5 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
             >
               <option value="all">All Time</option>
               <option value="today">Today</option>
               <option value="last7">Last 7 Days</option>
               <option value="last30">Last 30 Days</option>
               <option value="thisMonth">This Month</option>
               <option value="custom">Custom Range</option>
             </select>
           </div>
           
           <div className="flex items-end">
             <button 
               onClick={()=>{setSearch(''); setStatusFilter(''); setDateFilter('all'); setCustomStart(''); setCustomEnd('');}} 
               className="w-full px-4 py-2.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
             >
               Clear Filters
             </button>
           </div>
         </div>
         
         {dateFilter === 'custom' && (
           <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
               <input 
                 type="date" 
                 value={customStart} 
                 onChange={(e)=>setCustomStart(e.target.value)} 
                 className="w-full py-2.5 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
               />
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
               <input 
                 type="date" 
                 value={customEnd} 
                 onChange={(e)=>setCustomEnd(e.target.value)} 
                 className="w-full py-2.5 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
               />
             </div>
           </div>
         )}
       </div>

      {items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-500">Orders matching your filters will appear here</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* View Controls & Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium text-gray-900">
                {items.length} Order{items.length !== 1 ? 's' : ''} Found
              </div>
              <div className="text-sm text-gray-500">
                Total Value: {fmt(items.reduce((sum, [_, order]) => {
                  const amount = order.amount ?? order.total ?? (order.items ? order.items.reduce((s,it)=>s + ((it.price||0)*(it.quantity||1)), 0) : 0);
                  return sum + amount;
                }, 0))}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">View:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button 
                  onClick={()=>setViewMode('list')} 
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode==='list' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  List
                </button>
                <button 
                  onClick={()=>setViewMode('grid')} 
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode==='grid' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Grid
                </button>
              </div>
            </div>
          </div>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
              {items.map(([id, o]) => {
                const customer = o.customer || o.address || {};
                const shipping = o.shipping || o.address || {};
                const amount = o.amount ?? o.total ?? (o.items ? o.items.reduce((s,it)=>s + ((it.price||0)*(it.quantity||1)), 0) : 0);
                const status = o.status || 'pending';
                
                const getStatusStyle = (status) => {
                  switch(status) {
                    case 'delivered': return 'bg-green-100 text-green-800 ring-green-200';
                    case 'shipped': return 'bg-blue-100 text-blue-800 ring-blue-200';
                    case 'paid': return 'bg-purple-100 text-purple-800 ring-purple-200';
                    case 'cancelled': return 'bg-red-100 text-red-800 ring-red-200';
                    default: return 'bg-yellow-100 text-yellow-800 ring-yellow-200';
                  }
                };
                
                return (
                  <div key={id} className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-all hover:shadow-lg group">
                    {/* Card Header */}
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{customer?.name || 'Guest Customer'}</h3>
                          <p className="text-sm text-gray-500 mt-1">#{o.orderId || id}</p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${getStatusStyle(status)}`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                          </svg>
                          {o.items?.length || 0} item{(o.items?.length || 0) !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {customer?.phone?.slice(-4) || '****'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Product Images Preview */}
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-medium text-gray-700">Items:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {(o.items || []).slice(0, 4).map((it, idx) => (
                            <div key={idx} className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white bg-gray-50 flex-shrink-0">
                              {it.image ? (
                                <img src={it.image} alt={it.name || 'item'} className="w-full h-full object-cover"/>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          ))}
                          {(o.items?.length || 0) > 4 && (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600">
                              +{(o.items?.length || 0) - 4}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-600 truncate">
                            {(o.items || []).slice(0, 2).map(it => it.name || 'Item').join(', ')}
                            {(o.items?.length || 0) > 2 && '...'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Card Footer */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-xl font-bold text-gray-900">{fmt(amount)}</div>
                        <button 
                          onClick={()=>setSelected({ id, data: o })} 
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Details
                        </button>
                      </div>
                      
                      {/* Quick Actions */}
                      <div className="flex flex-wrap gap-2">
                        {status === 'shipped' && status !== 'delivered' && (
                          <button 
                            onClick={()=>updateStatus(id, 'delivered')} 
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 transition-colors"
                          >
                            Mark Delivered
                          </button>
                        )}
                        {status !== 'shipped' && status !== 'delivered' && (
                          <button 
                            onClick={()=>updateStatus(id, 'shipped')} 
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                          >
                            Mark Shipped
                          </button>
                        )}
                        {status !== 'paid' && (
                          <button 
                            onClick={()=>updateStatus(id, 'paid')} 
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
                          >
                            Mark Paid
                          </button>
                        )}
                        {status !== 'cancelled' && (
                          <button 
                            onClick={()=>updateStatus(id, 'cancelled')} 
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map(([id, o])=> {
                      const customer = o.customer || o.address || {};
                      const shipping = o.shipping || o.address || {};
                      const amount = o.amount ?? o.total ?? (o.items ? o.items.reduce((s,it)=>s + ((it.price||0)*(it.quantity||1)), 0) : 0);
                      const status = o.status || 'pending';
                      
                      const getStatusStyle = (status) => {
                        switch(status) {
                          case 'delivered': return 'bg-green-100 text-green-800 ring-green-200';
                          case 'shipped': return 'bg-blue-100 text-blue-800 ring-blue-200';
                          case 'paid': return 'bg-purple-100 text-purple-800 ring-purple-200';
                          case 'cancelled': return 'bg-red-100 text-red-800 ring-red-200';
                          default: return 'bg-yellow-100 text-yellow-800 ring-yellow-200';
                        }
                      };

                      return (
                        <tr key={id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">#{o.orderId || id}</div>
                              <div className="text-xs text-gray-500">{o.date || 'Unknown date'}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{customer?.name || 'Guest Customer'}</div>
                                <div className="text-sm text-gray-500">{customer?.phone || customer?.contact || ''}</div>
                                <div className="text-xs text-gray-400">{shipping?.city || ''}{shipping?.state ? ', ' + shipping.state : ''}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex -space-x-1 mr-3">
                                {(o.items || []).slice(0,3).map((it, idx) => (
                                  <div key={idx} className="w-8 h-8 rounded-md overflow-hidden border-2 border-white bg-gray-50">
                                    {it.image ? (
                                      <img src={it.image} alt={it.name || 'item'} className="w-full h-full object-cover"/>
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div>
                                <div className="text-sm text-gray-900">{o.items?.length || 0} item{(o.items?.length || 0) !== 1 ? 's' : ''}</div>
                                <div className="text-xs text-gray-500">
                                  {(o.items || []).slice(0,2).map(it => it.name || 'Item').join(', ')}
                                  {(o.items?.length || 0) > 2 && '...'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">{fmt(amount)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${getStatusStyle(status)}`}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <button 
                                onClick={()=>setSelected({ id, data: o })} 
                                className="text-blue-600 hover:text-blue-900 transition-colors"
                              >
                                View
                              </button>

                              {status === 'shipped' && status !== 'delivered' && (
                                <button 
                                  onClick={()=>updateStatus(id, 'delivered')} 
                                  className="text-green-600 hover:text-green-900 transition-colors"
                                >
                                  Deliver
                                </button>
                              )}
                              {status !== 'shipped' && status !== 'delivered' && (
                                <button 
                                  onClick={()=>updateStatus(id, 'shipped')} 
                                  className="text-blue-600 hover:text-blue-900 transition-colors"
                                >
                                  Ship
                                </button>
                              )}
                              {status !== 'paid' && (
                                <button 
                                  onClick={()=>updateStatus(id, 'paid')} 
                                  className="text-purple-600 hover:text-purple-900 transition-colors"
                                >
                                  Pay
                                </button>
                              )}
                              {status !== 'cancelled' && (
                                <button 
                                  onClick={()=>updateStatus(id, 'cancelled')} 
                                  className="text-red-600 hover:text-red-900 transition-colors"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={!!selected} hideActions onClose={()=>setSelected(null)} title={selected ? `Order Details - #${selected.data.orderId || selected.id}` : ''}>
        {selected && (
          <div className="space-y-6">
            {/* Order Status Banner */}
            <div className={`p-4 rounded-lg border-l-4 ${
              selected.data.status === 'delivered' ? 'bg-green-50 border-green-400' :
              selected.data.status === 'shipped' ? 'bg-blue-50 border-blue-400' :
              selected.data.status === 'paid' ? 'bg-purple-50 border-purple-400' :
              selected.data.status === 'cancelled' ? 'bg-red-50 border-red-400' :
              'bg-yellow-50 border-yellow-400'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Order Status</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Current status: <span className="font-medium capitalize">{selected.data.status || 'pending'}</span>
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    {fmt(selected.data.amount ?? selected.data.total ?? (selected.data.items ? selected.data.items.reduce((s,it)=>s + ((it.price||0)*(it.quantity||1)), 0) : 0))}
                  </div>
                  <div className="text-sm text-gray-500">Total Amount</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h4 className="font-semibold text-gray-900">Customer Information</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <span className="ml-2 font-medium">{(selected.data.customer?.name || selected.data.address?.name) || 'Guest Customer'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <span className="ml-2">{selected.data.customer?.email || selected.data.address?.email || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Phone:</span>
                    <span className="ml-2">{selected.data.customer?.phone || selected.data.address?.phone || 'Not provided'}</span>
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <h4 className="font-semibold text-gray-900">Shipping Address</h4>
                </div>
                <div className="text-sm text-gray-700">
                  <div>{selected.data.shipping?.line1 || selected.data.address?.line1 || 'Address line 1'}</div>
                  <div>{selected.data.shipping?.line2 || selected.data.address?.line2}</div>
                  <div className="mt-1">
                    <span>{selected.data.shipping?.city || selected.data.address?.city || 'City'}</span>
                    <span>, {selected.data.shipping?.state || selected.data.address?.state || 'State'}</span>
                    <span> - {selected.data.shipping?.pincode || selected.data.address?.pincode || 'PIN'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div>
              <div className="flex items-center mb-4">
                <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <h4 className="font-semibold text-gray-900">Order Items ({(selected.data.items || []).length})</h4>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {(selected.data.items || []).map((it, idx)=> (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="w-16 h-16 bg-white rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                      {it.image ? (
                        <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{it.name || 'Product Name'}</div>
                      <div className="text-sm text-gray-500">Product ID: {it.id || it.productId || it.sku || 'N/A'}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm text-gray-600">Quantity: {it.quantity || it.qty || 1}</span>
                        <span className="font-semibold text-gray-900">{fmt((it.price || 0) * (it.quantity || it.qty || 1))}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Information */}
            {selected.data.payment && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <h4 className="font-semibold text-gray-900">Payment Information</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Payment ID:</span>
                    <span className="ml-2 font-mono text-xs">{selected.data.payment?.razorpayPaymentId || selected.data.payment?.paymentId || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Order ID:</span>
                    <span className="ml-2 font-mono text-xs">{selected.data.payment?.razorpayOrderId || selected.data.payment?.orderId || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <div className="flex space-x-2">
                {selected.data.status !== 'shipped' && selected.data.status !== 'delivered' && (
                  <button 
                    onClick={()=>{updateStatus(selected.id, 'shipped'); setSelected(null);}} 
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Mark as Shipped
                  </button>
                )}
                {selected.data.status === 'shipped' && selected.data.status !== 'delivered' && (
                  <button 
                    onClick={()=>{updateStatus(selected.id, 'delivered'); setSelected(null);}} 
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    Mark as Delivered
                  </button>
                )}
                {selected.data.status !== 'paid' && (
                  <button 
                    onClick={()=>{updateStatus(selected.id, 'paid'); setSelected(null);}} 
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                  >
                    Mark as Paid
                  </button>
                )}
                {selected.data.status !== 'cancelled' && (
                  <button 
                    onClick={()=>{updateStatus(selected.id, 'cancelled'); setSelected(null);}} 
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    Cancel Order
                  </button>
                )}
              </div>
              <button 
                onClick={()=>setSelected(null)} 
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AdminCard>
  );
}
