import React, { useEffect, useState, useRef } from 'react';
import { db } from '../../firebase';
import { ref, onValue, push, update, remove, set } from 'firebase/database';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { showToast } from '../../components/Toast';
import { normalizeImageUrl } from '../../utils/imageHelpers';

export default function ProductsAdmin(){
  const [products, setProducts] = useState({});
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({name:'', price:'', slug:'', images:[], categoryId: '', stock: 0, inStock: true, description: '', originalPrice: '', discount: 0, rating: '', isBestseller: false, unit: '', unitValue: '', variants: {}});
  // keep previous price/original to avoid unnecessary updates
  const prevPriceRef = useRef({ price: '', originalPrice: '' });

  // auto-calc discount when originalPrice and price change
  useEffect(() => {
    const p = Number(form.price);
    const o = Number(form.originalPrice);
    if (!isNaN(p) && !isNaN(o) && o > 0) {
      const computed = o > p ? Math.round(((o - p) / o) * 100) : 0;
      // only update if changed to avoid re-renders
      if (String(prevPriceRef.current.price) !== String(form.price) || String(prevPriceRef.current.originalPrice) !== String(form.originalPrice)) {
        if (form.discount !== computed) setForm(f => ({ ...f, discount: computed }));
      }
    } else {
      if (form.discount !== 0 && (form.price === '' || form.originalPrice === '')) setForm(f => ({ ...f, discount: 0 }));
    }
    prevPriceRef.current = { price: form.price, originalPrice: form.originalPrice };
  }, [form.price, form.originalPrice]);

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
      if(form.originalPrice !== '' && isNaN(Number(form.originalPrice))) newErrors.originalPrice = 'Original price must be a number';
      if(form.discount !== '' && isNaN(Number(form.discount))) newErrors.discount = 'Discount must be a number';
      if(Number(form.discount) < 0 || Number(form.discount) > 100) newErrors.discount = 'Discount must be between 0 and 100';
      if(form.rating !== '' && (isNaN(Number(form.rating)) || Number(form.rating) < 0 || Number(form.rating) > 5)) newErrors.rating = 'Rating must be 0-5';
      // variants validation
      if(form.variants && Object.keys(form.variants).length){
        for(const [vk, v] of Object.entries(form.variants)){
          if(!v || !v.label || String(v.label).trim() === '' || v.price === '' || isNaN(Number(v.price))){
            newErrors.variants = 'Each variant must have an id, label and numeric price';
            break;
          }
        }
      }

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
        // update product
        const prevCategory = products[editing]?.categoryId;
        // coerce numeric fields and normalize variants before write
        const payload = {
          ...form,
          price: form.price === '' ? 0 : Number(form.price),
          originalPrice: form.originalPrice === '' ? null : Number(form.originalPrice),
          discount: form.discount === '' ? 0 : Number(form.discount),
          rating: form.rating === '' ? null : Number(form.rating),
          stock: Number(form.stock || 0),
          variants: (function(){
            if(!form.variants) return {};
            if(Array.isArray(form.variants)){
              const out = {};
              for(const v of form.variants){
                const id = v.id || (v.label ? String(v.label).toLowerCase().replace(/\s+/g,'-') : `v-${Date.now()}`);
                out[id] = { id, label: v.label, unit: v.unit || '', price: Number(v.price) };
              }
              return out;
            }
            // already an object keyed by id
            const out = {};
            for(const [k, v] of Object.entries(form.variants || {})){
              const id = v.id || k;
              out[id] = { id, label: v.label, unit: v.unit || '', price: Number(v.price) };
            }
            return out;
          })()
        };
        await update(ref(db, `/products/${editing}`), payload);
        // if category changed, update index mapping
        if(prevCategory !== form.categoryId){
          try{
            if(prevCategory) await remove(ref(db, `/categoryProducts/${prevCategory}/${editing}`));
          }catch(e){ /* ignore */ }
          if(form.categoryId) await set(ref(db, `/categoryProducts/${form.categoryId}/${editing}`), true);
        }
        showToast('Product updated');
      } else {
        // create product and maintain category index
        const newRef = push(ref(db, '/products'));
        const payload = {
          ...form,
          price: form.price === '' ? 0 : Number(form.price),
          originalPrice: form.originalPrice === '' ? null : Number(form.originalPrice),
          discount: form.discount === '' ? 0 : Number(form.discount),
          rating: form.rating === '' ? null : Number(form.rating),
          stock: Number(form.stock || 0),
          variants: (function(){
            if(!form.variants) return {};
            if(Array.isArray(form.variants)){
              const out = {};
              for(const v of form.variants){
                const id = v.id || (v.label ? String(v.label).toLowerCase().replace(/\s+/g,'-') : `v-${Date.now()}`);
                out[id] = { id, label: v.label, unit: v.unit || '', price: Number(v.price) };
              }
              return out;
            }
            const out = {};
            for(const [k, v] of Object.entries(form.variants || {})){
              const id = v.id || k;
              out[id] = { id, label: v.label, unit: v.unit || '', price: Number(v.price) };
            }
            return out;
          })()
        };
        await set(newRef, payload);
        const newId = newRef.key;
        if(form.categoryId) await set(ref(db, `/categoryProducts/${form.categoryId}/${newId}`), true);
        setForm({name:'', price:'', slug:'', images:[], categoryId: '', stock: 0, inStock: true, description: '', originalPrice: '', discount: 0, rating: '', isBestseller: false, unit: '', unitValue: '', variants: {}});
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
      // remove category mapping first
      const categoryId = products[toDelete]?.categoryId;
      if(categoryId) try{ await remove(ref(db, `/categoryProducts/${categoryId}/${toDelete}`)); }catch(e){}
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
        <input value={form.originalPrice} onChange={(e)=>setForm(f=>({...f, originalPrice: e.target.value}))} className="border p-2" placeholder="Original Price (optional)" />
        {errors.originalPrice && <div className="text-sm text-red-600 mt-1">{errors.originalPrice}</div>}
        <input value={form.discount} readOnly className="border p-2 bg-gray-100" placeholder="Discount (%)" />
        <div className="text-xs text-gray-500 mt-1 col-span-2">Auto-calculated from Original Price and Price</div>
        {errors.discount && <div className="text-sm text-red-600 mt-1">{errors.discount}</div>}
        <input value={form.slug} onChange={(e)=>setForm(f=>({...f, slug:e.target.value}))} className="border p-2" placeholder="Slug" />
        {errors.slug && <div className="text-sm text-red-600 mt-1">{errors.slug}</div>}
        <select value={form.categoryId||''} onChange={(e)=>setForm(f=>({...f, categoryId: e.target.value}))} className="border p-2">
          <option value="">— Select category —</option>
          {Object.entries(categories).map(([cid, c]) => (
            <option key={cid} value={cid}>{c.name}</option>
          ))}
        </select>
        <select value={form.unit||''} onChange={(e)=>setForm(f=>({...f, unit: e.target.value}))} className="border p-2">
          <option value="">— Unit / Size —</option>
          <option value="kg">kg</option>
          <option value="g">g</option>
          <option value="ltr">ltr</option>
          <option value="ml">ml</option>
          <option value="dozen">dozen</option>
          <option value="pcs">pcs</option>
          <option value="pack">pack</option>
        </select>
        <input value={form.unitValue||''} onChange={(e)=>setForm(f=>({...f, unitValue: e.target.value}))} className="border p-2" placeholder="Unit value (e.g. 500 g, 1 kg, 250 ml)" />
        <div className="flex items-center gap-2">
          <input type="number" min={0} value={form.stock||0} onChange={(e)=>setForm(f=>({...f, stock: Number(e.target.value||0)}))} className="border p-2 w-full" placeholder="Stock (qty)" />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!form.inStock} onChange={(e)=>setForm(f=>({...f, inStock: e.target.checked}))} />
            <span className="text-sm">In stock</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input value={form.rating||''} onChange={(e)=>setForm(f=>({...f, rating: e.target.value}))} type="number" min={0} max={5} step="0.1" className="border p-2 w-full" placeholder="Rating (0-5)" />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!form.isBestseller} onChange={(e)=>setForm(f=>({...f, isBestseller: e.target.checked}))} />
            <span className="text-sm">Bestseller</span>
          </label>
        </div>
        <input value={normalizeImageUrl(form.images?.[0])||''} onChange={(e)=>setForm(f=>({...f, images:[e.target.value]}))} className="border p-2" placeholder="Image URL" />

        {/* Variants editor */}
        <div className="col-span-2 border p-2">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Variants</div>
            <button type="button" onClick={()=>{
              const id = `v-${Date.now()}`;
              setForm(f=>({...f, variants: {...(f.variants||{}), [id]: { id, label: '', unit: '', price: '' }}}));
            }} className="text-sm text-blue-600">Add variant</button>
          </div>
          {errors.variants && <div className="text-sm text-red-600 mb-2">{errors.variants}</div>}
          <div className="space-y-2">
            {Object.entries(form.variants || {}).length ? Object.entries(form.variants || {}).map(([vk, v]) => (
              <div key={vk} className="flex gap-2 items-center">
                <input value={v.id||vk} onChange={(e)=>{
                  const newId = e.target.value.trim();
                  setForm(f=>{
                    const next = {...f}; next.variants = {...(next.variants||{})};
                    const existing = next.variants[vk];
                    if(!newId || newId === vk){
                      next.variants[vk] = {...existing, id: newId || vk};
                    } else {
                      // rename key
                      delete next.variants[vk];
                      next.variants[newId] = {...existing, id: newId};
                    }
                    return next;
                  });
                }} placeholder="Variant id (e.g. red-apple-250g)" className="border p-2 w-48" />
                <input value={v.label||''} onChange={(e)=>setForm(f=>{ const next = {...f}; next.variants = {...(next.variants||{})}; next.variants[vk] = { ...(next.variants[vk]||{}), label: e.target.value }; return next; })} placeholder="Label (e.g. 250 g)" className="border p-2 flex-1" />
                <input value={v.unit||''} onChange={(e)=>setForm(f=>{ const next = {...f}; next.variants = {...(next.variants||{})}; next.variants[vk] = { ...(next.variants[vk]||{}), unit: e.target.value }; return next; })} placeholder="Unit (e.g. 250g)" className="border p-2 w-32" />
                <input value={v.price||''} onChange={(e)=>setForm(f=>{ const next = {...f}; next.variants = {...(next.variants||{})}; next.variants[vk] = { ...(next.variants[vk]||{}), price: e.target.value }; return next; })} placeholder="Price" className="border p-2 w-32" />
                <button onClick={()=>setForm(f=>{ const next = {...f}; next.variants = {...(next.variants||{})}; delete next.variants[vk]; return next; })} className="text-red-600">Remove</button>
              </div>
            )) : (
              <div className="text-sm text-gray-500">No variants added</div>
            )}
          </div>
        </div>

        <textarea value={form.description||''} onChange={(e)=>setForm(f=>({...f, description: e.target.value}))} className="border p-2 col-span-2" placeholder="Description" rows={3} />
        {errors.description && <div className="text-sm text-red-600 mt-1 col-span-2">{errors.description}</div>}
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
               <button onClick={() => {
                 setEditing(id);
                 const variantsObj = p.variants && !Array.isArray(p.variants) ? p.variants : (Array.isArray(p.variants) ? p.variants.reduce((acc, v) => {
                   const vid = v.id || (v.label ? String(v.label).toLowerCase().replace(/\s+/g,'-') : `v-${Date.now()}`);
                   acc[vid] = { id: vid, label: v.label, unit: v.unit || (v.label ? v.label.replace(/\s+/g,'') : ''), price: v.price };
                   return acc;
                 }, {}) : {});
                 setForm({ ...p, variants: variantsObj });
               }} className="text-blue-600">Edit</button>
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
