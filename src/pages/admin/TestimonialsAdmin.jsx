import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, push, update, remove } from 'firebase/database';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { showToast } from '../../components/Toast';

export default function ReviewsAdmin(){
  const [reviews, setReviews] = useState({});
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({productId: '', name:'', message:'', rating:5, enabled:true});
  const [editing, setEditing] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  useEffect(()=>{
    const r = ref(db, '/reviews');
    const unsub = onValue(r, snap=>{
      setReviews(snap.val() || {});
      setLoading(false);
    });
    return unsub;
  },[]);

  useEffect(()=>{
    const pRef = ref(db, '/products');
    return onValue(pRef, snap=>{
      setProducts(snap.val() || {});
    });
  },[]);

  const handleSave = async ()=>{
    try{
      const payload = {
        productId: form.productId || null,
        name: form.name || '',
        message: form.message || '',
        rating: Number(form.rating) || 0,
        enabled: form.enabled === undefined ? true : !!form.enabled,
        createdAt: (new Date()).toISOString()
      };

      if(editing){
        await update(ref(db, `/reviews/${editing}`), payload);
        showToast('Review updated');
      } else {
        await push(ref(db, '/reviews'), payload);
        setForm({productId:'', name:'', message:'', rating:5, enabled:true});
        showToast('Review added');
      }
      setEditing(null);
    }catch(e){
      console.error(e);
      showToast('Error saving review');
    }
  };

  const confirmDelete = (id)=>{ setToDelete(id); setShowDelete(true); };
  const doDelete = async ()=>{
    try{
      await remove(ref(db, `/reviews/${toDelete}`));
      showToast('Review deleted');
    }catch(e){
      console.error(e);
      showToast('Error deleting review');
    }finally{
      setShowDelete(false); setToDelete(null);
    }
  };

  const toggleEnabled = async (id, current) => {
    try{
      await update(ref(db, `/reviews/${id}`), { enabled: !current });
      showToast(!current ? 'Review enabled' : 'Review disabled');
    }catch(e){
      console.error(e);
      showToast('Error updating review');
    }
  };

  if(loading) return <Loader />;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Reviews</h2>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-2">
        <div className="md:col-span-1">
          <label className="block text-sm font-medium mb-1">Product</label>
          <select value={form.productId} onChange={(e)=>setForm(f=>({...f, productId:e.target.value}))} className="border p-2 w-full">
            <option value="">(No product)</option>
            {Object.entries(products).map(([id, p])=> (
              <option key={id} value={id}>{p.name || p.title || id}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input value={form.name} onChange={(e)=>setForm(f=>({...f, name:e.target.value}))} className="border p-2 w-full" placeholder="Reviewer name" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Rating</label>
          <input type="number" min={1} max={5} value={form.rating} onChange={(e)=>setForm(f=>({...f, rating: Number(e.target.value) || 0}))} className="border p-2 w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Enabled</label>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={!!form.enabled} onChange={(e)=>setForm(f=>({...f, enabled: e.target.checked}))} />
            <span className="text-sm">Visible on site</span>
          </div>
        </div>

        <div className="md:col-span-4">
          <label className="block text-sm font-medium mb-1">Message</label>
          <textarea value={form.message} onChange={(e)=>setForm(f=>({...f, message:e.target.value}))} className="border p-2 w-full" placeholder="Review message" />
        </div>
      </div>

      <div className="mb-4">
        <button onClick={handleSave} className="bg-primary text-white px-3 py-2 rounded">Save</button>
        {editing && <button onClick={()=>{ setEditing(null); setForm({productId:'', name:'', message:'', rating:5, enabled:true}); }} className="ml-2 px-3 py-2">Cancel</button>}
      </div>

      <div className="space-y-2">
        {Object.entries(reviews).map(([id, r])=> (
          <div key={id} className="flex items-center justify-between border p-2 rounded">
            <div>
              <div className="font-semibold">{r.name} <span className="text-sm font-normal text-neutral-500">{r.rating}★</span></div>
              <div className="text-sm text-gray-600">{r.message}</div>
              <div className="text-xs text-neutral-500">Product: {r.productId ? (products[r.productId]?.name || r.productId) : '—'}</div>
              <div className="text-xs mt-1">Status: {r.enabled === false ? 'Disabled' : 'Enabled'}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{ setEditing(id); setForm({ productId: r.productId || '', name: r.name || '', message: r.message || '', rating: r.rating || 0, enabled: r.enabled === undefined ? true : !!r.enabled }); }} className="text-blue-600">Edit</button>
              <button onClick={()=>toggleEnabled(id, r.enabled === undefined ? true : !!r.enabled)} className="text-sm text-gray-700">{r.enabled === false ? 'Enable' : 'Disable'}</button>
              <button onClick={()=>confirmDelete(id)} className="text-red-600">Delete</button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showDelete} hideActions onClose={()=>setShowDelete(false)} title="Delete review?">
        <p>Are you sure?</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={()=>setShowDelete(false)} className="px-4 py-2">Cancel</button>
          <button onClick={doDelete} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
