import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, push, update, remove } from 'firebase/database';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { showToast } from '../../components/Toast';
import { normalizeImageUrl } from '../../utils/imageHelpers';

export default function GalleryAdmin(){
  const [gallery, setGallery] = useState({});
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [editing, setEditing] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  useEffect(()=>{
    const r = ref(db, '/gallery');
    return onValue(r, snap=>{
      setGallery(snap.val() || {});
      setLoading(false);
    });
  },[]);

  const handleSave = async ()=>{
    try{
      if(editing){
        await update(ref(db, `/gallery/${editing}`), { url });
        showToast('Gallery item updated');
      } else {
        await push(ref(db, '/gallery'), { url });
        setUrl('');
        showToast('Gallery item added');
      }
      setEditing(null);
    }catch(e){
      console.error(e);
      showToast('Error saving gallery item');
    }
  };

  const confirmDelete = (id)=>{ setToDelete(id); setShowDelete(true); };
  const doDelete = async ()=>{
    try{
      await remove(ref(db, `/gallery/${toDelete}`));
      showToast('Gallery item deleted');
    }catch(e){
      console.error(e);
      showToast('Error deleting gallery item');
    }finally{
      setShowDelete(false); setToDelete(null);
    }
  };

  if(loading) return <Loader />;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Gallery</h2>
      <div className="mb-4 flex gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Image URL</label>
          <input value={url} onChange={(e)=>setUrl(e.target.value)} className="border p-2" placeholder="Image URL" />
        </div>
        <div className="flex items-end">
          <button onClick={handleSave} className="bg-primary text-white px-3 py-1 rounded">Save</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {Object.entries(gallery).map(([id, g])=> (
          <div key={id} className="border p-2 rounded flex items-center justify-between">
            <img src={normalizeImageUrl(g.url)} alt="" className="w-20 h-20 object-cover rounded" />
            <div className="flex gap-2">
              <button onClick={()=>{setEditing(id); setUrl(g.url)}} className="text-blue-600">Edit</button>
              <button onClick={()=>confirmDelete(id)} className="text-red-600">Delete</button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showDelete} hideActions onClose={()=>setShowDelete(false)} title="Delete gallery item?">
        <p>Are you sure?</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={()=>setShowDelete(false)} className="px-4 py-2">Cancel</button>
          <button onClick={doDelete} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
