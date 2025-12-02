import React, { useEffect, useState, useRef } from 'react';
import { db } from '../../firebase';
import { ref, onValue, push, update, remove, set, get } from 'firebase/database';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { showToast } from '../../components/Toast';
import { normalizeImageUrl } from '../../utils/imageHelpers';
import UniversalImage from '../../components/UniversalImage';

export default function ProductsAdmin(){
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [form, setForm] = useState({name:'', price:'', slug:'', images:[], tags: [], longDescription: ''});
  const [categories, setCategories] = useState({});
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryImage, setNewCategoryImage] = useState('');
   const [tagInput, setTagInput] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const nameInputRef = useRef(null);

  // track existing gallery image URLs to avoid duplicates
  const [galleryUrls, setGalleryUrls] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');

  useEffect(()=>{
     const r = ref(db, '/gallery');
     return onValue(r, snap => {
       const g = snap.val() || {};
       const urls = Object.values(g).map(item => normalizeImageUrl(item.url));
       setGalleryUrls(urls);
     });
   },[]);

  // Drive converter utility state and handler (moved from HomepageAdmin)
  const [driveInput, setDriveInput] = useState('');
  const [convertedDriveLink, setConvertedDriveLink] = useState('');

  const handleConvertClick = () => {
    const out = normalizeImageUrl((driveInput || '').trim());
    setConvertedDriveLink(out);
    try{ navigator.clipboard?.writeText(out); showToast('Converted link copied to clipboard'); }catch(e){}
  };

  // helper to read gallery once and push any missing normalized images
  const addImagesToGallery = async (images) => {
    try{
      const imgs = (images || []).map(i => normalizeImageUrl(i)).filter(Boolean);
      if(imgs.length === 0) return;
      const snap = await get(ref(db, '/gallery'));
      const g = snap.val() || {};
      const existing = new Set(Object.values(g).map(item => normalizeImageUrl(item.url)));
      for(const img of imgs){
        if(!existing.has(img)){
          await push(ref(db, '/gallery'), { url: img });
          existing.add(img);
        }
      }
    }catch(e){
      console.error('Failed to add images to gallery', e);
    }
  };

  useEffect(()=>{
    const r = ref(db, '/products');
    return onValue(r, snap=>{
      const val = snap.val();
      console.debug('[ProductsAdmin] /products snapshot', { keys: val ? Object.keys(val) : [], count: val ? Object.keys(val).length : 0, sample: val ? Object.entries(val).slice(0,3) : [] });
      setProducts(val || {});
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

      // remove undefined properties since Firebase Realtime Database cannot store undefined
      Object.keys(normalized).forEach((k) => {
        if (normalized[k] === undefined) delete normalized[k];
      });

      if(editing){
        // If editing, write to the exact product key. Use set to replace/ensure values update in place.
        await set(ref(db, `/products/${editing}`), normalized);
        showToast('Product updated');
        // also add any new product images to the gallery (avoid duplicates)
        await addImagesToGallery(normalized.images);
       } else {
         await push(ref(db, '/products'), normalized);
         setForm({name:'', price:'', slug:'', images:[], tags: [], longDescription: ''});
         showToast('Product created');
        // add product images to gallery when creating
        await addImagesToGallery(normalized.images);
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
    // accept single tag or comma-separated tags, trim and dedupe
    const raw = (t !== undefined && t !== null) ? String(t) : String(tagInput || '');
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    const next = Array.isArray(form.tags) ? [...form.tags] : [];
    for (const part of parts) {
      if (!next.includes(part)) next.push(part);
    }
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

  const handleNewProduct = () => {
    setEditing(null);
    setForm({ name: '', price: '', slug: '', images: [], tags: [], longDescription: '' });
    // focus the name field if available
    setTimeout(() => { if (nameInputRef.current) nameInputRef.current.focus(); }, 50);
  };

  if(loading) return <Loader />;

  // compute filtered product entries based on search and category filter
  const filteredProductEntries = Object.entries(products).filter(([id, p]) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const inName = (p.name || '').toLowerCase().includes(q);
      const inSlug = (p.slug || '').toLowerCase().includes(q);
      const inTags = (Array.isArray(p.tags) ? p.tags : (p.tags ? String(p.tags).split(',') : [])).join(' ').toLowerCase().includes(q);
      if (!inName && !inSlug && !inTags) return false;
    }
    if (filterCategoryId && p.categoryId !== filterCategoryId) return false;
    return true;
  });

  // gather all tags present in the product catalog for quick add
  const availableTags = (() => {
    const s = new Set();
    Object.values(products || {}).forEach((p) => {
      const tags = Array.isArray(p.tags) ? p.tags : (p.tags ? String(p.tags).split(',').map(t=>t.trim()).filter(Boolean) : []);
      tags.forEach(t => { if (t) s.add(t); });
    });
    return Array.from(s).sort((a,b) => a.localeCompare(b));
  })();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Products</h2>
        <div className="flex items-center gap-2">
          <button onClick={handleNewProduct} className="px-3 py-2 bg-green-600 text-white rounded">New product</button>
        </div>
      </div>

      {/* Drive converter utility moved here */}
      <div className="mb-4 p-4 border rounded bg-white">
        <h3 className="font-medium mb-2">Google Drive → Direct link</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Drive share URL</label>
            <input value={driveInput} onChange={(e)=>setDriveInput(e.target.value)} className="border p-2 w-full" placeholder="https://drive.google.com/file/d/FILEID/view?usp=sharing" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleConvertClick} className="px-3 py-2 bg-primary-600 text-white rounded">Convert & copy</button>
            <button onClick={()=>{ setDriveInput(''); setConvertedDriveLink(''); }} className="px-3 py-2 border rounded">Clear</button>
          </div>
        </div>
        {convertedDriveLink && (
          <div className="mt-3">
            <div className="text-sm text-neutral-600 mb-1">Direct link</div>
            <div className="flex items-center gap-2">
              <input value={convertedDriveLink} readOnly className="border p-2 flex-1" />
              <button onClick={()=>{ navigator.clipboard?.writeText(convertedDriveLink); showToast('Copied'); }} className="px-3 py-2 border rounded">Copy</button>
            </div>
            <div className="mt-3">
              <div className="text-sm text-neutral-600 mb-1">Preview</div>
              <div className="w-48 h-32 bg-neutral-100 border flex items-center justify-center">
                <UniversalImage src={convertedDriveLink} alt="preview" className="max-w-full max-h-full object-contain" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: form (displayed second on md+) */}
        <div className="md:order-2">
          <div className="space-y-3">
            {/* name */}
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input ref={nameInputRef} value={form.name} onChange={(e)=>setForm(f=>({...f, name:e.target.value}))} className="border p-2 w-full" placeholder="Name" />
            </div>

            {/* price / original */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  onChange={(e)=>{ const origVal = e.target.value; setForm(f=>{ const priceNum = Number(f.price || 0); const originalNum = Number(origVal || 0); const computed = originalNum > 0 ? Math.round(((originalNum - priceNum) / originalNum) * 100) : 0; return { ...f, originalPrice: origVal, discount: computed > 0 ? computed : 0 }; }); }}
                  className="border p-2 w-full"
                  placeholder="Original Price (MRP)"
                />
              </div>
            </div>

            {/* slug / sku */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Slug</label>
                <input value={form.slug} onChange={(e)=>setForm(f=>({...f, slug:e.target.value}))} className="border p-2 w-full" placeholder="Slug" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">SKU</label>
                <input value={form.sku || ''} onChange={(e)=>setForm(f=>({...f, sku:e.target.value}))} className="border p-2 w-full" placeholder="SKU" />
              </div>
            </div>

            {/* category + inline create */}
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select value={form.categoryId || ''} onChange={(e)=>{ const id = e.target.value || ''; setForm(f=>({ ...f, categoryId: id, categoryName: id ? (categories?.[id]?.name || '') : '', categorySlug: id ? (categories?.[id]?.slug || '') : '' })); }} className="border p-2 w-full">
                <option value=''>Uncategorized</option>
                {Object.entries(categories).map(([id, c]) => (<option key={id} value={id}>{c.name}</option>))}
              </select>
              {form.categoryId && categories?.[form.categoryId]?.image ? (
                <div className="mt-2">
                  <UniversalImage src={categories[form.categoryId].image} alt={categories[form.categoryId].name} className="w-24 h-16 object-cover rounded" />
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

            {/* discount */}
            <div>
              <label className="block text-sm font-medium mb-1">Discount (%)</label>
              <input value={form.discount || ''} onChange={(e)=>setForm(f=>({...f, discount:e.target.value}))} className="border p-2 w-full" placeholder="Discount (%)" />
            </div>

            {/* images */}
            <div>
              <label className="block text-sm font-medium mb-2">Images</label>
              <div className="space-y-2">
                {(form.images || []).map((img, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input value={img || ''} onChange={(e)=>{ const next = [...(form.images || [])]; next[idx] = e.target.value; setForm(f=>({...f, images: next})); }} className="border p-2 flex-1" placeholder={`Image URL ${idx+1}`} />
                    <button type="button" onClick={()=>{ const next = (form.images || []).filter((_,i)=>i!==idx); setForm(f=>({...f, images: next})); }} className="px-2 py-1 border text-red-600 rounded">Remove</button>
                  </div>
                ))}

                <div>
                  <button type="button" onClick={()=>setForm(f=>({...f, images: [...(f.images||[]), '']}))} className="px-3 py-2 border rounded">Add image</button>
                  <div className="text-sm text-neutral-500 mt-1">Provide full image URLs (one per entry). The first image is used as primary.</div>
                </div>
              </div>
            </div>

            {/* meta */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-gray-700"><input type="checkbox" checked={Boolean(form.bestseller)} onChange={(e)=>setForm(f=>({...f, bestseller: e.target.checked}))} /> Bestseller</label>
              <label className="flex items-center gap-2 text-gray-700"><input type="checkbox" checked={Boolean(form.freeShipping)} onChange={(e)=>setForm(f=>({...f, freeShipping: e.target.checked}))} /> Free Shipping</label>
              <label className="flex items-center gap-2 text-gray-700"><input type="checkbox" checked={Boolean(form.isNew)} onChange={(e)=>setForm(f=>({...f, isNew: e.target.checked}))} /> New</label>
              <label className="flex items-center gap-2 text-gray-700"><input type="checkbox" checked={Boolean(form.inStock)} onChange={(e)=>setForm(f=>({...f, inStock: e.target.checked}))} /> In stock</label>
            </div>

            <div className="grid grid-cols-3 gap-2">
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Materials</label>
                <input value={form.materials || ''} onChange={(e)=>setForm(f=>({...f, materials:e.target.value}))} className="border p-2 w-full text-gray-800" placeholder="Materials" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Weight</label>
                <input value={form.weight || ''} onChange={(e)=>setForm(f=>({...f, weight:e.target.value}))} className="border p-2 w-full text-gray-800" placeholder="Weight" />
              </div>
            </div>

            {/* description / long description */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Description</label>
              <textarea value={form.longDescription || ''} onChange={(e)=>setForm(f=>({...f, longDescription: e.target.value}))} className="border p-2 w-full h-28 text-gray-800" placeholder="Long description / product details" />
            </div>

            <div className="grid grid-cols-2 gap-2">
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
               {/* available tags for quick add */}
               {availableTags.length > 0 && (
                 <div className="mt-3">
                   <div className="text-sm font-medium mb-2 text-gray-700">All tags</div>
                   <div className="flex flex-wrap gap-2">
                     {availableTags.map(tag => (
                       <button
                         key={tag}
                         type="button"
                         onClick={() => addTag(tag)}
                         className={`px-2 py-1 rounded text-sm ${ (form.tags || []).includes(tag) ? 'bg-gray-300 text-gray-700' : 'bg-gray-100 text-gray-800' }`}
                       >
                         {tag}
                       </button>
                     ))}
                   </div>
                 </div>
               )}
              <div className="text-sm text-neutral-500 mt-1">Tags will be saved as an array on the product object.</div>
            </div>

            <div className="flex gap-3 mt-3">
              <button onClick={handleSave} className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700">{editing ? 'Update' : 'Save'}</button>
              {editing && <button onClick={()=>{ setEditing(null); setForm({name:'', price:'', slug:'', images:[], tags: [], longDescription: ''}); }} className="px-3 py-2 border rounded">Cancel</button>}
            </div>
          </div>
        </div>

        {/* Right: product list (displayed first on md+) */}
        <div className="md:order-1">
          <h3 className="text-lg font-medium mb-2">Products</h3>
          <div className="mb-3 flex gap-2 items-center">
            <input value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} placeholder="Search by name, slug or tag" className="border p-2 flex-1" />
            <select value={filterCategoryId} onChange={(e)=>setFilterCategoryId(e.target.value)} className="border p-2">
              <option value=''>All categories</option>
              {Object.entries(categories).map(([cid, c]) => (<option key={cid} value={cid}>{c.name}</option>))}
            </select>
            <button onClick={()=>{ setSearchQuery(''); setFilterCategoryId(''); }} className="px-3 py-2 border rounded">Clear</button>
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-neutral-600">Showing {filteredProductEntries.length} / {Object.keys(products).length}</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setViewMode('list')} className={`px-2 py-1 rounded ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'bg-gray-100'}`}>List</button>
              <button onClick={() => setViewMode('grid')} className={`px-2 py-1 rounded ${viewMode === 'grid' ? 'bg-primary-600 text-white' : 'bg-gray-100'}`}>Grid</button>
            </div>
          </div>

          {viewMode === 'list' ? (
            <div className="space-y-2 overflow-y-auto max-h-[65vh]">
              {filteredProductEntries.map(([id, p]) => (
                 <div key={id} className="flex items-center justify-between border p-2 rounded">
                   <div className="text-gray-800">{p.name} - ₹{p.price}</div>
                   <div className="flex gap-2">
                     <button onClick={(e) => { e.stopPropagation(); setEditing(id); setForm({ ...p, tags: Array.isArray(p.tags) ? p.tags : (p.tags ? String(p.tags).split(',').map(s => s.trim()).filter(Boolean) : []) }); }} className="text-blue-600">Edit</button>
                     <button onClick={(e) => { e.stopPropagation(); const copied = {
                         name: p.name || '',
                         price: p.price !== undefined ? String(p.price) : '',
                         originalPrice: p.originalPrice ?? p.mrp ?? '',
                         slug: '', sku: '', categoryId: p.categoryId || '',
                         categoryName: p.categoryName || (p.categoryId ? (categories?.[p.categoryId]?.name || '') : ''),
                         categorySlug: p.categorySlug || (p.categoryId ? (categories?.[p.categoryId]?.slug || '') : ''),
                         discount: p.discount !== undefined ? String(p.discount) : '',
                         images: Array.isArray(p.images) ? p.images : (p.images ? [String(p.images)] : []),
                         tags: Array.isArray(p.tags) ? p.tags : (p.tags ? String(p.tags).split(',').map(s => s.trim()).filter(Boolean) : []),
                         bestseller: Boolean(p.bestseller),
                         freeShipping: Boolean(p.freeShipping),
                         isNew: Boolean(p.isNew),
                         avgRating: p.avgRating !== undefined ? p.avgRating : 0,
                         reviewCount: p.reviewCount !== undefined ? p.reviewCount : 0,
                         stock: p.stock !== undefined ? String(p.stock) : '',
                         materials: p.materials || '',
                         weight: p.weight || '',
                         dimensions: p.dimensions || '',
                         manufacturer: p.manufacturer || '',
                         inStock: p.inStock !== undefined ? Boolean(p.inStock) : false,
                         longDescription: p.longDescription || ''
                       }; setEditing(null); setForm(copied); showToast('Product copied — edit and Save to create new'); }} className="text-gray-700">Copy</button>
                     <button onClick={(e) => { e.stopPropagation(); confirmDelete(id); }} className="text-red-600">Delete</button>
                   </div>
                 </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 overflow-auto max-h-[65vh]">
              {filteredProductEntries.map(([id, p]) => (
                <div key={id} className="border rounded p-3 bg-white flex flex-col justify-between h-full">
                  <div>
                    <div className="w-full h-40 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                      {Array.isArray(p.images) && p.images[0] ? (
                        <UniversalImage src={p.images[0]} alt={p.name} className="w-full h-full object-contain" />
                      ) : (p.image ? <UniversalImage src={p.image} alt={p.name} className="w-full h-full object-contain" /> : <div className="text-xs text-neutral-500">No image</div>)}
                    </div>
                    <div className="mt-3">
                      <div className="font-medium text-gray-800">{p.name}</div>
                      <div className="text-sm text-neutral-600">₹{p.price} • {p.categoryName || ''}</div>
                      {p.tags && p.tags.length > 0 && <div className="mt-2 text-sm text-neutral-500">{(Array.isArray(p.tags) ? p.tags : String(p.tags).split(',')).slice(0,3).join(', ')}{(Array.isArray(p.tags) ? p.tags.length : String(p.tags).split(',').length) > 3 ? '...' : ''}</div>}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex gap-2">
                      <button onClick={()=>{ setEditing(id); setForm({ ...p, tags: Array.isArray(p.tags) ? p.tags : (p.tags ? String(p.tags).split(',').map(s=>s.trim()).filter(Boolean) : []) }); }} className="text-sm text-blue-600">Edit</button>
                      <button onClick={()=>{ const copied = { ...p, slug: '', images: Array.isArray(p.images) ? p.images : (p.images ? [String(p.images)] : []) }; setEditing(null); setForm(copied); showToast('Product copied — edit and Save to create new'); }} className="text-sm text-gray-700">Copy</button>
                    </div>
                    <div>
                      <button onClick={()=>confirmDelete(id)} className="text-sm text-red-600">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showDelete} hideActions onClose={() => setShowDelete(false)} title="Delete product?">
        <p>Are you sure you want to delete this product?</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setShowDelete(false)} className="px-4 py-2">Cancel</button>
          <button onClick={doDelete} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
