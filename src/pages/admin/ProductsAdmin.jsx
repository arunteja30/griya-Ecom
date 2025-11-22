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
      <div className="mb-4 grid grid-cols-2 gap-2">
        <input value={form.name} onChange={(e)=>setForm(f=>({...f, name:e.target.value}))} className="border p-2" placeholder="Name" />
        <input value={form.price} onChange={(e)=>setForm(f=>({...f, price:e.target.value}))} className="border p-2" placeholder="Price" />
        <input value={form.slug} onChange={(e)=>setForm(f=>({...f, slug:e.target.value}))} className="border p-2" placeholder="Slug" />
        <input value={normalizeImageUrl(form.images?.[0])||''} onChange={(e)=>setForm(f=>({...f, images:[e.target.value]}))} className="border p-2" placeholder="Image URL" />
        <button onClick={handleSave} className="col-span-2 bg-primary text-white px-3 py-2 rounded">Save</button>
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
