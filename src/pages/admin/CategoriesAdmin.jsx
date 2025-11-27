import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, push, update, remove } from 'firebase/database';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { showToast } from '../../components/Toast';

export default function CategoriesAdmin(){
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
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
      if(editing){
        await update(ref(db, `/categories/${editing}`), { name, image: image || '' });
        showToast('Category updated');
      } else {
        await push(ref(db, '/categories'), { name, slug: name.toLowerCase().replace(/\s+/g,'-'), image: image || '' });
        setName('');
        setImage('');
        showToast('Category created');
      }
      setEditing(null);
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
          <label className="block text-sm font-medium mb-1">Category name</label>
          <input value={name} onChange={(e)=>setName(e.target.value)} className="border p-2 w-full" placeholder="Category name" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Image URL</label>
          <input value={image} onChange={(e)=>setImage(e.target.value)} className="border p-2 w-full" placeholder="Image URL (optional)" />
        </div>
        <div className="flex gap-2 items-end">
          <button onClick={handleSave} className="bg-black text-white px-3 py-2 rounded">Save</button>
          {editing && <button onClick={()=>{setEditing(null); setName(''); setImage('');}} className="px-3 py-2">Cancel</button>}
        </div>
      </div>

      <div className="space-y-2">
        {Object.entries(categories).map(([id, cat])=> (
          <div key={id} className="flex items-center justify-between border p-2 rounded">
            <div className="flex items-center gap-3">
              {cat.image ? <img src={cat.image} alt={cat.name} className="w-10 h-10 object-cover rounded" /> : null}
              <div>
                <div className="font-medium">{cat.name}</div>
                <div className="text-sm text-neutral-600">{cat.slug}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{setEditing(id); setName(cat.name); setImage(cat.image || '');}} className="text-blue-600">Edit</button>
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
