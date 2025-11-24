import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, push, update, remove } from 'firebase/database';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { showToast } from '../../components/Toast';
import { normalizeImageUrl } from '../../utils/imageHelpers';

export default function ProductsAdmin(){
  const [products, setProducts] = useState({});
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({name:'', price:'', slug:'', images:[], categoryId: '', stock: 0, inStock: true});
  const [showDelete, setShowDelete] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  // validation errors shown under form fields
  const [errors, setErrors] = useState({});
  // filters for admin list
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // all | in | out

  useEffect(()=>{
    const r = ref(db, '/products');
    return onValue(r, snap=>{
      setProducts(snap.val() || {});
      setLoading(false);
    });
  },[]);

  // load categories for the category select
  useEffect(()=>{
    const r2 = ref(db, '/categories');
    return onValue(r2, snap => {
      setCategories(snap.val() || {});
    });
  },[]);

  const handleSave = async ()=>{
    try{
      // clear previous errors
      setErrors({});

      // basic validation
      const newErrors = {};
      if(!form.name || String(form.name).trim() === '') newErrors.name = 'Name is required';
      if(!form.slug || String(form.slug).trim() === '') newErrors.slug = 'Slug is required';
      if(form.price !== '' && isNaN(Number(form.price))) newErrors.price = 'Price must be a number';

      // duplicate check (by slug or name)
      const entries = Object.entries(products || {});
      const dup = entries.find(([id, p]) => {
        if(editing && id === editing) return false; // ignore same record when editing
        if(form.slug && p.slug && String(p.slug).trim().toLowerCase() === String(form.slug).trim().toLowerCase()) return 'slug';
        if(form.name && p.name && String(p.name).trim().toLowerCase() === String(form.name).trim().toLowerCase()) return 'name';
        return false;
      });
      if(dup){
        // dup may be the array element; determine which field matched
        const matchField = typeof dup === 'string' ? dup : (Array.isArray(dup) && dup[1] ? (String(dup[1].slug || '').trim().toLowerCase() === String(form.slug || '').trim().toLowerCase() ? 'slug' : 'name') : 'name');
        if(matchField === 'slug') newErrors.slug = 'Another product has the same slug';
        else newErrors.name = 'Another product has the same name';
      }

      if(Object.keys(newErrors).length){
        setErrors(newErrors);
        return;
      }

      if(editing){
        await update(ref(db, `/products/${editing}`), form);
        showToast('Product updated');
      } else {
        await push(ref(db, '/products'), form);
        setForm({name:'', price:'', slug:'', images:[], categoryId: '', stock: 0, inStock: true});
        showToast('Product created');
      }
      setErrors({});
      setEditing(null);
    }catch(e){
      console.error(e);
      showToast('Error saving product');
    }
  };

  // derive filtered products list based on filters
  const filteredProducts = Object.entries(products || {}).filter(([id, p]) => {
    if(search){
      const q = search.trim().toLowerCase();
      const name = (p.name || '').toString().toLowerCase();
      const slug = (p.slug || '').toString().toLowerCase();
      if(!name.includes(q) && !slug.includes(q)) return false;
    }
    if(categoryFilter){
      if((p.categoryId || '') !== categoryFilter) return false;
    }
    if(stockFilter === 'in'){
      if(!p.inStock || Number(p.stock || 0) <= 0) return false;
    } else if(stockFilter === 'out'){
      if(p.inStock && Number(p.stock || 0) > 0) return false;
    }
    return true;
  });

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
      {/* Filters */}
      <div className="mb-4 flex items-center gap-2">
        <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search name or slug" className="border p-2 rounded w-1/3" />
        <select value={categoryFilter} onChange={(e)=>setCategoryFilter(e.target.value)} className="border p-2 rounded">
          <option value="">All categories</option>
          {Object.entries(categories).map(([cid, c]) => (
            <option key={cid} value={cid}>{c.name}</option>
          ))}
        </select>
        <select value={stockFilter} onChange={(e)=>setStockFilter(e.target.value)} className="border p-2 rounded">
          <option value="all">All stock</option>
          <option value="in">In stock</option>
          <option value="out">Out of stock</option>
        </select>
        <button onClick={()=>{setSearch(''); setCategoryFilter(''); setStockFilter('all');}} className="ml-auto text-sm text-neutral-600">Clear</button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <input value={form.name} onChange={(e)=>setForm(f=>({...f, name:e.target.value}))} className="border p-2" placeholder="Name" />
        {errors.name && <div className="text-sm text-red-600 mt-1">{errors.name}</div>}
        <input value={form.price} onChange={(e)=>setForm(f=>({...f, price:e.target.value}))} className="border p-2" placeholder="Price" />
        {errors.price && <div className="text-sm text-red-600 mt-1">{errors.price}</div>}
        <input value={form.slug} onChange={(e)=>setForm(f=>({...f, slug:e.target.value}))} className="border p-2" placeholder="Slug" />
        {errors.slug && <div className="text-sm text-red-600 mt-1">{errors.slug}</div>}
        <select value={form.categoryId||''} onChange={(e)=>setForm(f=>({...f, categoryId: e.target.value}))} className="border p-2">
          <option value="">— Select category —</option>
          {Object.entries(categories).map(([cid, c]) => (
            <option key={cid} value={cid}>{c.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input type="number" min={0} value={form.stock||0} onChange={(e)=>setForm(f=>({...f, stock: Number(e.target.value||0)}))} className="border p-2 w-full" placeholder="Stock (qty)" />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!form.inStock} onChange={(e)=>setForm(f=>({...f, inStock: e.target.checked}))} />
            <span className="text-sm">In stock</span>
          </label>
        </div>
        <input value={normalizeImageUrl(form.images?.[0])||''} onChange={(e)=>setForm(f=>({...f, images:[e.target.value]}))} className="border p-2" placeholder="Image URL" />
        <button onClick={handleSave} className="col-span-2 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded">Save</button>
      </div>

      <div className="space-y-2">
        {filteredProducts.map(([id, p])=> (
          <div key={id} className="flex items-center justify-between border p-2 rounded">
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-gray-600">{categories[p.categoryId]?.name || 'Uncategorized'} • ₹{p.price}</div>
              <div className="text-sm mt-1">
                {(!p.inStock || Number(p.stock || 0) <= 0) ? (
                  <span className="text-red-600 font-semibold">Out of stock</span>
                ) : (
                  <span className="text-green-600">In stock — {p.stock || 0}</span>
                )}
              </div>
            </div>
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
