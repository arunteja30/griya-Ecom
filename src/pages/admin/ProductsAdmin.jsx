import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, push, update, remove, set } from 'firebase/database';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { showToast } from '../../components/Toast';
import { normalizeImageUrl } from '../../utils/imageHelpers';

export default function ProductsAdmin(){
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({name:'', price:'', slug:'', images:[], tags: []});
  const [categories, setCategories] = useState({});
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryImage, setNewCategoryImage] = useState('');
   const [tagInput, setTagInput] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  useEffect(()=>{
    const r = ref(db, '/products');
    return onValue(r, snap=>{
      setProducts(snap.val() || {});
      setLoading(false);
    });
  },[]);

  // load categories so admin can assign a product to one
  useEffect(()=>{
    const r = ref(db, '/categories');
    return onValue(r, snap => {
      setCategories(snap.val() || {});
    });
  },[]);

  const handleSave = async ()=>{
    try{
      // normalize form values to avoid accidental structure changes
      const normalized = {
        name: String(form.name || '').trim(),
        price: form.price !== undefined ? Number(form.price || 0) : undefined,
        originalPrice: form.originalPrice !== undefined ? Number(form.originalPrice || form.mrp || 0) : undefined,
        slug: form.slug || '',
        sku: form.sku || '',
        // category fields (store id and readable name/slug for browsing)
        categoryId: form.categoryId || undefined,
        categoryName: form.categoryName || (form.categoryId ? (categories?.[form.categoryId]?.name || '') : ''),
        categorySlug: form.categorySlug || (form.categoryId ? (categories?.[form.categoryId]?.slug || '') : ''),
        discount: form.discount !== undefined ? Number(form.discount || 0) : undefined,
        images: Array.isArray(form.images) ? form.images : (form.images ? [String(form.images)] : []),
        tags: Array.isArray(form.tags) ? form.tags : (form.tags ? String(form.tags).split(',').map(s=>s.trim()).filter(Boolean) : []),
        bestseller: Boolean(form.bestseller),
        freeShipping: Boolean(form.freeShipping),
        isNew: Boolean(form.isNew),
        avgRating: form.avgRating !== undefined ? Number(form.avgRating) : undefined,
        reviewCount: form.reviewCount !== undefined ? Number(form.reviewCount) : undefined,
        stock: form.stock !== undefined ? (form.stock === '' ? undefined : Number(form.stock)) : undefined,
        materials: form.materials || '',
        weight: form.weight || '',
        dimensions: form.dimensions || '',
        manufacturer: form.manufacturer || '',
        inStock: form.inStock !== undefined ? Boolean(form.inStock) : undefined,
        longDescription: form.longDescription || ''
      };

      if(editing){
        // If editing, write to the exact product key. Use set to replace/ensure values update in place.
        await set(ref(db, `/products/${editing}`), normalized);
        showToast('Product updated');
      } else {
        await push(ref(db, '/products'), normalized);
        setForm({name:'', price:'', slug:'', images:[], tags: []});
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

  const addTag = (t) => {
    const tag = (t || tagInput || '').trim();
    if (!tag) return;
    const next = Array.isArray(form.tags) ? [...form.tags] : [];
    if (!next.includes(tag)) next.push(tag);
    setForm(f => ({ ...f, tags: next }));
    setTagInput('');
  };

  const removeTag = (tag) => {
    const next = (form.tags || []).filter(t => t !== tag);
    setForm(f => ({ ...f, tags: next }));
  };

  const createCategoryInline = async () => {
    const name = (newCategoryName || '').trim();
    if(!name){ showToast('Provide a category name'); return; }
    try{
      const slug = name.toLowerCase().replace(/\s+/g,'-');
      const payload = { name, slug, image: newCategoryImage || '' };
      const refRes = await push(ref(db, '/categories'), payload);
      const key = refRes.key;
      showToast('Category created');
      setNewCategoryName('');
      setNewCategoryImage('');
      // assign newly created category to product form
      setForm(f=>({ ...f, categoryId: key, categoryName: name, categorySlug: slug }));
    }catch(e){
      console.error('Failed to create category', e);
      showToast('Failed to create category');
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
          <input
            value={form.price}
            onChange={(e)=>{
              const priceVal = e.target.value;
              setForm(f=>{
                const original = Number(f.originalPrice ?? f.mrp ?? 0);
                const priceNum = Number(priceVal || 0);
                const computed = original > 0 ? Math.round(((original - priceNum) / original) * 100) : 0;
                return { ...f, price: priceVal, discount: computed > 0 ? computed : 0 };
              });
            }}
            className="border p-2 w-full"
            placeholder="Price"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Original Price (MRP)</label>
          <input
            value={form.originalPrice || form.mrp || ''}
            onChange={(e)=>{
              const origVal = e.target.value;
              setForm(f=>{
                const priceNum = Number(f.price || 0);
                const originalNum = Number(origVal || 0);
                const computed = originalNum > 0 ? Math.round(((originalNum - priceNum) / originalNum) * 100) : 0;
                return { ...f, originalPrice: origVal, discount: computed > 0 ? computed : 0 };
              });
            }}
            className="border p-2 w-full"
            placeholder="Original Price (MRP)"
          />
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
          <label className="block text-sm font-medium mb-1">Category</label>
          <select value={form.categoryId || ''} onChange={(e)=>{
            const id = e.target.value || '';
            setForm(f=>({ ...f, categoryId: id, categoryName: id ? (categories?.[id]?.name || '') : '', categorySlug: id ? (categories?.[id]?.slug || '') : '' }));
          }} className="border p-2 w-full">
            <option value=''>Uncategorized</option>
            {Object.entries(categories).map(([id, c]) => (
              <option key={id} value={id}>{c.name}</option>
            ))}
          </select>
          {form.categoryId && categories?.[form.categoryId]?.image ? (
            <div className="mt-2">
              <img src={categories[form.categoryId].image} alt={categories[form.categoryId].name} className="w-24 h-16 object-cover rounded" />
            </div>
          ) : null}
          <div className="mt-2 p-2 border rounded bg-gray-50">
            <div className="text-sm text-gray-700 mb-1">Add category inline</div>
            <div className="grid grid-cols-1 gap-2">
              <input value={newCategoryName} onChange={(e)=>setNewCategoryName(e.target.value)} className="border p-2" placeholder="New category name" />
              <input value={newCategoryImage} onChange={(e)=>setNewCategoryImage(e.target.value)} className="border p-2" placeholder="Image URL (optional)" />
              <div className="flex gap-2">
                <button type="button" onClick={createCategoryInline} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Create & assign</button>
                <button type="button" onClick={()=>{ setNewCategoryName(''); setNewCategoryImage(''); }} className="px-3 py-1 border rounded text-sm">Clear</button>
              </div>
            </div>
          </div>
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
            <label className="flex items-center gap-2 text-gray-700"><input type="checkbox" checked={Boolean(form.bestseller)} onChange={(e)=>setForm(f=>({...f, bestseller: e.target.checked}))} /> Bestseller</label>
            <label className="flex items-center gap-2 text-gray-700"><input type="checkbox" checked={Boolean(form.freeShipping)} onChange={(e)=>setForm(f=>({...f, freeShipping: e.target.checked}))} /> Free Shipping</label>
            <label className="flex items-center gap-2 text-gray-700"><input type="checkbox" checked={Boolean(form.isNew)} onChange={(e)=>setForm(f=>({...f, isNew: e.target.checked}))} /> New</label>
          </div>

          <div className="grid grid-cols-3 gap-2 col-span-1 md:col-span-2">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Average Rating</label>
              <input type="number" step="0.1" min="0" max="5" value={form.avgRating ?? 0} onChange={(e)=>setForm(f=>({...f, avgRating: Number(e.target.value)}))} className="border p-2 w-full text-gray-800" placeholder="Average rating (0-5)" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Review Count</label>
              <input type="number" value={form.reviewCount ?? 0} onChange={(e)=>setForm(f=>({...f, reviewCount: Number(e.target.value)}))} className="border p-2 w-full text-gray-800" placeholder="Review count" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Stock</label>
              <input value={form.stock || ''} onChange={(e)=>setForm(f=>({...f, stock:e.target.value}))} className="border p-2 w-full text-gray-800" placeholder="Stock" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 col-span-1 md:col-span-2">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Materials</label>
              <input value={form.materials || ''} onChange={(e)=>setForm(f=>({...f, materials:e.target.value}))} className="border p-2 w-full text-gray-800" placeholder="Materials" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Weight</label>
              <input value={form.weight || ''} onChange={(e)=>setForm(f=>({...f, weight:e.target.value}))} className="border p-2 w-full text-gray-800" placeholder="Weight" />
            </div>
          </div>

          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium mb-1 text-gray-700">Tags</label>
            <div className="flex gap-2 items-center">
              <input className="border p-2 flex-1" placeholder="Add tag and press Add" value={tagInput} onChange={(e)=>setTagInput(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter'){ e.preventDefault(); addTag(); } }} />
              <button type="button" onClick={()=>addTag()} className="px-3 py-2 border rounded">Add</button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {(form.tags || []).map((t, i) => (
                <span key={i} className="inline-flex items-center gap-2 bg-gray-100 px-3 py-1 rounded text-sm">
                  <span>{t}</span>
                  <button type="button" onClick={()=>removeTag(t)} className="text-red-600">✕</button>
                </span>
              ))}
            </div>
            <div className="text-sm text-neutral-500 mt-1">Tags will be saved as an array on the product object.</div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Dimensions</label>
            <input value={form.dimensions || ''} onChange={(e)=>setForm(f=>({...f, dimensions:e.target.value}))} className="border p-2 w-full text-gray-800" placeholder="Dimensions" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Manufacturer</label>
            <input value={form.manufacturer || ''} onChange={(e)=>setForm(f=>({...f, manufacturer:e.target.value}))} className="border p-2 w-full text-gray-800" placeholder="Manufacturer" />
          </div>
          <div className="flex items-center gap-2 p-2">
            <label className="flex items-center gap-2 text-gray-700"><input type="checkbox" checked={Boolean(form.inStock)} onChange={(e)=>setForm(f=>({...f, inStock: e.target.checked}))} /> In stock</label>
          </div>
          <textarea value={form.longDescription || ''} onChange={(e)=>setForm(f=>({...f, longDescription:e.target.value}))} className="border p-2 md:col-span-2 text-gray-800" placeholder="Long description / details" rows={3} />
          <button onClick={handleSave} className="col-span-1 md:col-span-2 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700">{editing ? 'Update' : 'Save'}</button>
              </div>

              <div className="space-y-2">
          {Object.entries(products).map(([id, p])=> (
            <div key={id} className="flex items-center justify-between border p-2 rounded">
              <div className="text-gray-800">{p.name} - ₹{p.price}</div>
              <div className="flex gap-2">
                <button onClick={()=>{
                  setEditing(id);
                  setForm({ ...p, tags: Array.isArray(p.tags) ? p.tags : (p.tags ? String(p.tags).split(',').map(s=>s.trim()).filter(Boolean) : []) });
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
