import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, push, update, remove } from 'firebase/database';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { showToast } from '../../components/Toast';

export default function TestimonialsAdmin(){
  const [testimonials, setTestimonials] = useState({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({name:'', message:''});
  const [editing, setEditing] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  useEffect(()=>{
    const r = ref(db, '/testimonials');
    return onValue(r, snap=>{
      setTestimonials(snap.val() || {});
      setLoading(false);
    });
  },[]);

  const handleSave = async ()=>{
    try{
      if(editing){
        await update(ref(db, `/testimonials/${editing}`), form);
        showToast('Testimonial updated');
      } else {
        await push(ref(db, '/testimonials'), form);
        setForm({name:'', message:''});
        showToast('Testimonial added');
      }
      setEditing(null);
    }catch(e){
      console.error(e);
      showToast('Error saving testimonial');
    }
  };

  const confirmDelete = (id)=>{ setToDelete(id); setShowDelete(true); };
  const doDelete = async ()=>{
    try{
      await remove(ref(db, `/testimonials/${toDelete}`));
      showToast('Testimonial deleted');
    }catch(e){
      console.error(e);
      showToast('Error deleting testimonial');
    }finally{
      setShowDelete(false); setToDelete(null);
    }
  };

  if(loading) return <Loader />;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Testimonials</h2>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input value={form.name} onChange={(e)=>setForm(f=>({...f, name:e.target.value}))} className="border p-2 w-full" placeholder="Name" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <input value={form.message} onChange={(e)=>setForm(f=>({...f, message:e.target.value}))} className="border p-2 w-full" placeholder="Message" />
        </div>
      </div>
      <button onClick={handleSave} className="col-span-2 bg-primary text-white px-3 py-2 rounded">Save</button>

      <div className="space-y-2">
        {Object.entries(testimonials).map(([id, t])=> (
          <div key={id} className="flex items-center justify-between border p-2 rounded">
            <div>
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm text-gray-600">{t.message}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{setEditing(id); setForm({...t})}} className="text-blue-600">Edit</button>
              <button onClick={()=>confirmDelete(id)} className="text-red-600">Delete</button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showDelete} hideActions onClose={()=>setShowDelete(false)} title="Delete testimonial?">
        <p>Are you sure?</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={()=>setShowDelete(false)} className="px-4 py-2">Cancel</button>
          <button onClick={doDelete} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
