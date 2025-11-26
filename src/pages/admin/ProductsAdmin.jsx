import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, push, update, remove } from 'firebase/database';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { showToast } from '../../components/Toast';
import { normalizeImageUrl } from '../../utils/imageHelpers';

export default function ProductsAdmin(){
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({name:'', price:'', slug:'', images:[]});
  const [showDelete, setShowDelete] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  useEffect(()=>{
    const r = ref(db, '/products');
    return onValue(r, snap=>{
      setProducts(snap.val() || {});
      setLoading(false);
    });
  },[]);

  const handleSave = async ()=>{
    try{
      if(editing){
        await update(ref(db, `/products/${editing}`), form);
        showToast('Product updated');
      } else {
        await push(ref(db, '/products'), form);
        setForm({name:'', price:'', slug:'', images:[]});
        showToast('Product created');
      }
      setEditing(null);
    }catch(e){
      console.error(e);
      showToast('Error saving product');
    }
  };

  const confirmDelete = (id)=>{
    setToDelete(id);
    setShowDelete(true);
  };

  const doDelete = async ()=>{
    try{
      await remove(ref(db, `/products/${toDelete}`));
      showToast('Product deleted');
    }catch(e){
      console.error(e);
      showToast('Error deleting product');
    }finally{
      setShowDelete(false);
      setToDelete(null);
    }
  };

  if(loading) return <Loader />;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Products</h2>
      <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input value={form.name} onChange={(e)=>setForm(f=>({...f, name:e.target.value}))} className="border p-2 w-full" placeholder="Name" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Price (INR)</label>
          <input value={form.price} onChange={(e)=>setForm(f=>({...f, price:e.target.value}))} className="border p-2 w-full" placeholder="Price" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Original Price (MRP)</label>
          <input value={form.originalPrice || form.mrp || ''} onChange={(e)=>setForm(f=>({...f, originalPrice: e.target.value}))} className="border p-2 w-full" placeholder="Original Price (MRP)" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Slug</label>
          <input value={form.slug} onChange={(e)=>setForm(f=>({...f, slug:e.target.value}))} className="border p-2 w-full" placeholder="Slug" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">SKU</label>
          <input value={form.sku || ''} onChange={(e)=>setForm(f=>({...f, sku:e.target.value}))} className="border p-2 w-full" placeholder="SKU" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Discount (%)</label>
          <input value={form.discount || ''} onChange={(e)=>setForm(f=>({...f, discount:e.target.value}))} className="border p-2 w-full" placeholder="Discount (%)" />
        </div>
        {/* Images: support multiple image URLs */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium mb-2">Images</label>
          <div className="space-y-2">
            {(form.images || []).map((img, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input value={img || ''} onChange={(e)=>{
                  const next = [...(form.images || [])];
                  next[idx] = e.target.value;
                  setForm(f=>({...f, images: next}));
                }} className="border p-2 flex-1" placeholder={`Image URL ${idx+1}`} />
                <button type="button" onClick={()=>{
                  const next = (form.images || []).filter((_,i)=>i!==idx);
                  setForm(f=>({...f, images: next}));
                }} className="px-2 py-1 border text-red-600 rounded">Remove</button>
              </div>
            ))}

            <div>
              <button type="button" onClick={()=>setForm(f=>({...f, images: [...(f.images||[]), '']}))} className="px-3 py-2 border rounded">Add image</button>
              <div className="text-sm text-neutral-500 mt-1">Provide full image URLs (one per entry). The first image is used as primary.</div>
            </div>
          </div>
        </div>

        {/* New tactical/product metadata fields */}
        <div className="col-span-1 md:col-span-2 flex items-center gap-4">
          <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(form.bestseller)} onChange={(e)=>setForm(f=>({...f, bestseller: e.target.checked}))} /> Bestseller</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(form.freeShipping)} onChange={(e)=>setForm(f=>({...f, freeShipping: e.target.checked}))} /> Free Shipping</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(form.isNew)} onChange={(e)=>setForm(f=>({...f, isNew: e.target.checked}))} /> New</label>
        </div>

        <div className="grid grid-cols-3 gap-2 col-span-1 md:col-span-2">
          <div>
            <label className="block text-sm font-medium mb-1">Average Rating</label>
            <input type="number" step="0.1" min="0" max="5" value={form.avgRating ?? 0} onChange={(e)=>setForm(f=>({...f, avgRating: Number(e.target.value)}))} className="border p-2 w-full" placeholder="Average rating (0-5)" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Review Count</label>
            <input type="number" value={form.reviewCount ?? 0} onChange={(e)=>setForm(f=>({...f, reviewCount: Number(e.target.value)}))} className="border p-2 w-full" placeholder="Review count" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Stock</label>
            <input value={form.stock || ''} onChange={(e)=>setForm(f=>({...f, stock:e.target.value}))} className="border p-2 w-full" placeholder="Stock" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 col-span-1 md:col-span-2">
          <div>
            <label className="block text-sm font-medium mb-1">Materials</label>
            <input value={form.materials || ''} onChange={(e)=>setForm(f=>({...f, materials:e.target.value}))} className="border p-2 w-full" placeholder="Materials" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Weight</label>
            <input value={form.weight || ''} onChange={(e)=>setForm(f=>({...f, weight:e.target.value}))} className="border p-2 w-full" placeholder="Weight" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Dimensions</label>
          <input value={form.dimensions || ''} onChange={(e)=>setForm(f=>({...f, dimensions:e.target.value}))} className="border p-2 w-full" placeholder="Dimensions" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Manufacturer</label>
          <input value={form.manufacturer || ''} onChange={(e)=>setForm(f=>({...f, manufacturer:e.target.value}))} className="border p-2 w-full" placeholder="Manufacturer" />
        </div>
        <div className="flex items-center gap-2 p-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(form.inStock)} onChange={(e)=>setForm(f=>({...f, inStock: e.target.checked}))} /> In stock</label>
        </div>
        <textarea value={form.longDescription || ''} onChange={(e)=>setForm(f=>({...f, longDescription:e.target.value}))} className="border p-2 md:col-span-2" placeholder="Long description / details" rows={3} />
        <button onClick={handleSave} className="col-span-1 md:col-span-2 bg-primary text-white px-3 py-2 rounded">Save</button>
      </div>

      <div className="space-y-2">
        {Object.entries(products).map(([id, p])=> (
          <div key={id} className="flex items-center justify-between border p-2 rounded">
            <div>{p.name} - ₹{p.price}</div>
            <div className="flex gap-2">
              <button onClick={()=>{setEditing(id); setForm({...p})}} className="text-blue-600">Edit</button>
              <button onClick={()=>confirmDelete(id)} className="text-red-600">Delete</button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showDelete} hideActions onClose={()=>setShowDelete(false)} title="Delete product?">
        <p>Are you sure you want to delete this product?</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={()=>setShowDelete(false)} className="px-4 py-2">Cancel</button>
          <button onClick={doDelete} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
