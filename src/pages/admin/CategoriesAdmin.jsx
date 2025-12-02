import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, push, update, remove, set } from 'firebase/database';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { showToast } from '../../components/Toast';
import UniversalImage from '../../components/UniversalImage';

export default function CategoriesAdmin(){
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  // form fields for category
  const [catId, setCatId] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  useEffect(()=>{
    const r = ref(db, '/categories');
    return onValue(r, snap=>{
      setCategories(snap.val() || {});
      setLoading(false);
    });
  },[]);

  const handleSave = async ()=>{
    try{
      // Build payload without including undefined properties (Firebase rejects undefined)
      const payload = {
        name: String(name || '').trim(),
        slug: slug || String(name || '').toLowerCase().replace(/\s+/g,'-'),
        image: image || '',
        description: description || ''
      };

      if (sortOrder !== '') {
        payload.sortOrder = Number(sortOrder);
      }

      if (editing) {
        // update existing category key
        await update(ref(db, `/categories/${editing}`), payload);
        showToast('Category updated');
      } else {
        // create: if catId provided, write at that key, otherwise push
        if (catId && String(catId).trim()) {
          const key = String(catId).trim();
          await set(ref(db, `/categories/${key}`), payload);
          showToast('Category created');
        } else {
          await push(ref(db, '/categories'), payload);
          showToast('Category created');
        }
      }

      // reset form
      setEditing(null);
      setCatId(''); setName(''); setSlug(''); setImage(''); setDescription(''); setSortOrder('');
    }catch(e){
      console.error(e);
      showToast('Error saving category');
    }
  };

  const confirmDelete = (id)=>{
    setToDelete(id);
    setShowDelete(true);
  };

  const doDelete = async ()=>{
    try{
      await remove(ref(db, `/categories/${toDelete}`));
      showToast('Category deleted');
    }catch(e){
      console.error(e);
      showToast('Error deleting category');
    }finally{
      setShowDelete(false);
      setToDelete(null);
    }
  };

  if(loading) return <Loader />;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Categories</h2>
      <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium mb-1">Category ID (key)</label>
          <input
            value={catId}
            onChange={(e)=>setCatId(e.target.value)}
            disabled={!!editing}
            className="border p-2 w-full"
            placeholder="e.g. cat_gold — leave empty to auto-generate"
          />
          {editing ? (
            <div className="text-xs text-neutral-500 mt-1">Editing existing category — ID cannot be changed.</div>
          ) : (
            <div className="text-xs text-neutral-500 mt-1">Optional. Provide to set a custom key (avoid spaces).</div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Category name</label>
          <input value={name} onChange={(e)=>setName(e.target.value)} className="border p-2 w-full" placeholder="Category name" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Slug</label>
          <input value={slug} onChange={(e)=>setSlug(e.target.value)} className="border p-2 w-full" placeholder="Slug (auto-generated from name)" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Image URL</label>
          <input value={image} onChange={(e)=>setImage(e.target.value)} className="border p-2 w-full" placeholder="Image URL (optional)" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <input value={description} onChange={(e)=>setDescription(e.target.value)} className="border p-2 w-full" placeholder="Description (optional)" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Sort Order</label>
          <input type="number" value={sortOrder} onChange={(e)=>setSortOrder(e.target.value)} className="border p-2 w-full" placeholder="Sort order (optional)" />
        </div>
        <div className="flex gap-2 items-end">
          <button onClick={handleSave} className="btn btn-primary">{editing ? 'Update' : 'Create'}</button>
          {editing && <button onClick={()=>{setEditing(null); setCatId(''); setName(''); setSlug(''); setImage(''); setDescription(''); setSortOrder('');}} className="px-3 py-2">Cancel</button>}
        </div>
      </div>

      <div className="space-y-2">
        {Object.entries(categories).map(([id, cat])=> (
          <div key={id} className="flex items-center justify-between border p-2 rounded">
            <div className="flex items-center gap-3">
              {cat.image ? <UniversalImage src={cat.image} alt={cat.name} className="w-10 h-10 object-cover rounded" /> : null}
              <div>
                <div className="font-medium">{cat.name}</div>
                <div className="text-sm text-neutral-600">{cat.slug}</div>
                {cat.description ? <div className="text-xs text-neutral-500">{cat.description}</div> : null}
                {cat.sortOrder !== undefined && <div className="text-xs text-neutral-500">Sort: {cat.sortOrder}</div>}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{
                setEditing(id);
                setCatId(id);
                setName(cat.name || '');
                setSlug(cat.slug || '');
                setImage(cat.image || '');
                setDescription(cat.description || '');
                setSortOrder(cat.sortOrder !== undefined ? String(cat.sortOrder) : '');
              }} className="text-blue-600">Edit</button>
              <button onClick={()=>confirmDelete(id)} className="text-red-600">Delete</button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showDelete} hideActions onClose={()=>setShowDelete(false)} title="Delete category?">
        <p>Are you sure you want to delete this category?</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={()=>setShowDelete(false)} className="px-4 py-2">Cancel</button>
          <button onClick={doDelete} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
