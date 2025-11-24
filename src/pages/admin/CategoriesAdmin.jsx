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
  const [imageUrl, setImageUrl] = useState('');
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
      const payload = { name, slug: name.toLowerCase().replace(/\s+/g,'-') };
      if (imageUrl) payload.image = imageUrl;

      if(editing){
        await update(ref(db, `/categories/${editing}`), payload);
        showToast('Category updated');
      } else {
        await push(ref(db, '/categories'), payload);
        setName('');
        setImageUrl('');
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
      <div className="mb-4 grid grid-cols-1 gap-3">
        <input 
          value={name} 
          onChange={(e)=>setName(e.target.value)} 
          className="border p-2" 
          placeholder="Category name" 
          id="category-name-input"
        />
        <input value={imageUrl} onChange={(e)=>setImageUrl(e.target.value)} className="border p-2" placeholder="Image URL" />
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSave} 
            className="ml-2 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded"
          >
            {editing ? 'Update Category' : 'Create Category'}
          </button>
          {editing && (
            <button 
              onClick={() => { setEditing(null); setName(''); setImageUrl(''); }} 
              className="ml-2 text-sm text-gray-600"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {Object.entries(categories).map(([id, cat])=> (
          <div key={id} className="flex items-center justify-between border p-2 rounded">
            <div className="flex items-center gap-3">
              {cat.image ? (
                <img src={cat.image} alt={cat.name} className="w-12 h-12 object-cover rounded" />
              ) : (
                <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-sm text-gray-500">No image</div>
              )}
              <div>
                <div className="font-medium">{cat.name}</div>
                {cat.slug && <div className="text-xs text-gray-500">/{cat.slug}</div>}
              </div>
            </div>
            <div className="flex gap-2">
              {editing === id ? (
                <>
                  <button onClick={handleSave} className="text-green-600">Save</button>
                  <button onClick={() => { setEditing(null); setName(''); setImageUrl(''); }} className="text-gray-600">Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={()=>{setEditing(id); setName(cat.name); setImageUrl(cat.image||'')}} className="text-blue-600">Edit</button>
                  <button onClick={()=>confirmDelete(id)} className="text-red-600">Delete</button>
                </>
              )}
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
