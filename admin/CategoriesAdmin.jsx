import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, push, update, remove, set } from 'firebase/database';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { showToast } from '../../components/Toast';

export default function CategoriesAdmin(){
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  // form fields
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [tags, setTags] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [viewMode, setViewMode] = useState('list');
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
      const computedSlug = slug && String(slug).trim() !== '' ? slug : (name ? name.toLowerCase().replace(/\s+/g,'-') : '');
      const payload = { name, slug: computedSlug };
      if (imageUrl) payload.image = imageUrl;
      if (description) payload.description = description;
      if(sortOrder !== undefined && sortOrder !== null) payload.sortOrder = Number(sortOrder);
      if(tags && tags.length) payload.tags = tags;
      if(subcategories && subcategories.length) payload.subcategories = subcategories;

      if(editing){
        await update(ref(db, `/categories/${editing}`), payload);
        // reset form after update
        setCategoryId('');
        setName('');
        setSlug('');
        setImageUrl('');
        setDescription('');
        setSortOrder(0);
        setTags([]);
        setSubcategories([]);
        showToast('Category updated');
      } else {
        if(categoryId && String(categoryId).trim() !== ''){
          // create with custom id
          await set(ref(db, `/categories/${categoryId}`), payload);
        } else {
          await push(ref(db, '/categories'), payload);
        }
        // reset form
        setCategoryId('');
        setName('');
        setSlug('');
        setImageUrl('');
        setDescription('');
        setSortOrder(0);
        setTags([]);
        setSubcategories([]);
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

  // copy category data into the form for creating a new category (do not set editing)
  const copyToForm = (cat) => {
    setEditing(null);
    setCategoryId(''); // new id will be generated unless user supplies one
    setName(cat.name || '');
    setSlug(''); // clear slug so user can set a new one
    setImageUrl(cat.image || '');
    setDescription(cat.description || '');
    setSortOrder(cat.sortOrder || 0);
    setTags(cat.tags || []);
    setSubcategories(cat.subcategories || []);
    showToast('Category copied to form — edit and Save to create a new category');
  };

  if(loading) return <Loader />;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Categories</h2>
      <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        {/* Row 1: Category ID and Slug */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Category ID (optional)</label>
          <input
            value={categoryId}
            onChange={(e)=>setCategoryId(e.target.value)}
            className="border p-2 w-full"
            placeholder="Custom category id (optional)"
            disabled={!!editing}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Slug</label>
          <input value={slug} onChange={(e)=>setSlug(e.target.value)} className="border p-2 w-full" placeholder="Slug (optional, auto from name)" />
        </div>

        {/* Row 2: Name full width */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Category name</label>
          <input 
            value={name} 
            onChange={(e)=>setName(e.target.value)} 
            className="border p-2 w-full" 
            placeholder="Category name" 
            id="category-name-input"
          />
        </div>

        {/* Row 3: Image URL and Sort order */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Image URL</label>
          <input value={imageUrl} onChange={(e)=>setImageUrl(e.target.value)} className="border p-2 w-full" placeholder="Image URL" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Sort order</label>
          <input type="number" value={sortOrder} onChange={(e)=>setSortOrder(Number(e.target.value||0))} className="border p-2 w-full" placeholder="Sort order (number)" />
        </div>

        {/* Row 4: Tags full width */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Tags</label>
          <input
            value={(tags || []).join(', ')}
            onChange={(e)=>setTags(String(e.target.value || '').split(',').map(t=>t.trim()).filter(Boolean))}
            className="border p-2 w-full"
            placeholder="Tags (comma-separated)"
          />
          <div className="text-xs text-gray-500 mt-1">Tags are saved as an array.</div>
        </div>

        {/* Row: Subcategories list (repeatable) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Subcategories</label>
          <div className="space-y-2">
            {(subcategories || []).map((sc, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center border p-2 rounded">
                <div className="md:col-span-1">
                  <input value={sc.id || sc.subcategoryId || ''} onChange={(e)=>{ const copy = [...subcategories]; copy[idx] = { ...copy[idx], id: e.target.value }; setSubcategories(copy); }} className="border p-2 w-full" placeholder="Subcategory id (optional)" />
                </div>
                <div className="md:col-span-2">
                  <input value={sc.name || ''} onChange={(e)=>{
                    const copy = [...subcategories]; copy[idx] = { ...copy[idx], name: e.target.value }; setSubcategories(copy);
                  }} className="border p-2 w-full" placeholder="Subcategory name" />
                </div>
                <div className="md:col-span-1">
                  <input value={sc.slug || ''} onChange={(e)=>{ const copy = [...subcategories]; copy[idx] = { ...copy[idx], slug: e.target.value }; setSubcategories(copy); }} className="border p-2 w-full" placeholder="Slug" />
                </div>
                <div className="md:col-span-2">
                  <input value={sc.image || ''} onChange={(e)=>{ const copy = [...subcategories]; copy[idx] = { ...copy[idx], image: e.target.value }; setSubcategories(copy); }} className="border p-2 w-full" placeholder="Image URL" />
                </div>
                <div className="md:col-span-1">
                  <input value={(sc.tags||[]).join(', ')} onChange={(e)=>{ const copy = [...subcategories]; copy[idx] = { ...copy[idx], tags: String(e.target.value||'').split(',').map(t=>t.trim()).filter(Boolean) }; setSubcategories(copy); }} className="border p-2 w-full" placeholder="Tags (comma-separated)" />
                </div>
                <div className="md:col-span-6">
                  <input value={sc.description || ''} onChange={(e)=>{ const copy = [...subcategories]; copy[idx] = { ...copy[idx], description: e.target.value }; setSubcategories(copy); }} className="border p-2 w-full mt-2" placeholder="Description (optional)" />
                </div>
                <div className="md:col-span-1 flex items-center gap-2">
                  <button type="button" onClick={()=>{
                    const copy = [...subcategories]; copy.splice(idx,1); setSubcategories(copy);
                  }} className="px-2 py-1 text-sm text-red-600">Remove</button>
                </div>
              </div>
            ))}

            <div>
              <button type="button" onClick={()=>setSubcategories(prev => ([...(prev||[]), { name:'', slug:'', image:'', description:'' }]))} className="px-3 py-1 bg-gray-100 rounded">Add subcategory</button>
            </div>
          </div>
        </div>

        {/* Row 5: Description full width */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea value={description} onChange={(e)=>setDescription(e.target.value)} className="border p-2 w-full" rows={3} placeholder="Description (optional)" />
        </div>

        {/* Actions: span full width and align right */}
        <div className="md:col-span-2 flex items-center justify-end gap-3">
          <button 
            onClick={handleSave} 
            className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded"
          >
            {editing ? 'Update Category' : 'Create Category'}
          </button>
          {editing && (
            <button 
              onClick={() => { setEditing(null); setCategoryId(''); setName(''); setSlug(''); setImageUrl(''); setDescription(''); setSortOrder(0); setTags([]); setSubcategories([]); }} 
              className="text-sm text-gray-600"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium">Categories ({Object.keys(categories || {}).length})</div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={()=>setViewMode('list')} className={`px-2 py-1 rounded ${viewMode==='list' ? 'bg-gray-200' : ''}`}>List</button>
          <button type="button" onClick={()=>setViewMode('grid')} className={`px-2 py-1 rounded ${viewMode==='grid' ? 'bg-gray-200' : ''}`}>Grid</button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(categories).map(([id, cat]) => (
            <div key={id} className="border p-3 rounded bg-white">
              <div className="w-full h-36 bg-gray-100 mb-3 flex items-center justify-center overflow-hidden">
                {cat.image ? <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" /> : <div className="text-xs text-gray-500">No image</div>}
              </div>
              <div className="font-medium">{cat.name}</div>
              {cat.slug && <div className="text-xs text-gray-500">/{cat.slug}</div>}
              {cat.description && <div className="text-xs text-gray-600 mt-1">{cat.description}</div>}
              {cat.tags && cat.tags.length ? <div className="text-xs text-gray-500 mt-2">Tags: {cat.tags.join(', ')}</div> : null}

              {cat.subcategories && cat.subcategories.length ? (
                <div className="mt-2">
                  <div className="text-xs text-gray-500 mb-1">Subcategories:</div>
                  <div className="flex flex-wrap gap-2">
                    {cat.subcategories.map((sc, idx) => (
                      <div key={sc.id || sc.subcategoryId || sc.slug || idx} className="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded text-xs">
                        {sc.image ? <img src={sc.image} alt={sc.name} className="w-6 h-6 object-cover rounded" /> : null}
                        <span>{sc.name || sc.title || sc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 mt-3">
                {editing === id ? (
                  <>
                    <button onClick={handleSave} className="text-green-600 text-sm">Save</button>
                    <button onClick={() => { setEditing(null); setCategoryId(''); setName(''); setSlug(''); setImageUrl(''); setDescription(''); setSortOrder(0); setTags([]); }} className="text-gray-600 text-sm">Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={()=>{setEditing(id); setCategoryId(id); setName(cat.name); setSlug(cat.slug||''); setImageUrl(cat.image||''); setDescription(cat.description||''); setSortOrder(cat.sortOrder||0); setTags(cat.tags||[]); setSubcategories(cat.subcategories||[]);}} className="text-blue-600 text-sm">Edit</button>
                    <button onClick={()=>confirmDelete(id)} className="text-red-600 text-sm">Delete</button>
                    <button onClick={()=>copyToForm(cat)} className="text-green-600 text-sm">Copy</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
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
                  {cat.description && <div className="text-xs text-gray-500 mt-1">{cat.description}</div>}

                  {cat.subcategories && cat.subcategories.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {cat.subcategories.map((sc, idx) => (
                        <div key={sc.id || sc.subcategoryId || sc.slug || idx} className="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded text-xs">
                          {sc.image ? <img src={sc.image} alt={sc.name} className="w-5 h-5 object-cover rounded" /> : null}
                          <span>{sc.name || sc.title || sc}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                </div>
              </div>
              <div className="flex gap-2">
                {editing === id ? (
                  <>
                    <button onClick={handleSave} className="text-green-600">Save</button>
                    <button onClick={() => { setEditing(null); setCategoryId(''); setName(''); setSlug(''); setImageUrl(''); setDescription(''); setSortOrder(0); setTags([]); setSubcategories([]); }} className="text-gray-600">Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={()=>{setEditing(id); setCategoryId(id); setName(cat.name); setSlug(cat.slug||''); setImageUrl(cat.image||''); setDescription(cat.description||''); setSortOrder(cat.sortOrder||0); setTags(cat.tags||[]); setSubcategories(cat.subcategories||[]);}} className="text-blue-600">Edit</button>
                    <button onClick={()=>confirmDelete(id)} className="text-red-600">Delete</button>
                    <button onClick={()=>copyToForm(cat)} className="text-green-600">Copy</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
