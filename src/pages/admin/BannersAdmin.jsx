import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, set } from 'firebase/database';
import Loader from '../../components/Loader';
import { showToast } from '../../components/Toast';
import { normalizeImageUrl } from '../../utils/imageHelpers';

// helper: convert ISO or other date string to value usable by <input type="datetime-local">
function formatForInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function BannersAdmin(){
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opBusy, setOpBusy] = useState(false);
  const [newBanner, setNewBanner] = useState({ image:'', heading:'', body:'', ctaLabel:'', link:'', startDate:'', endDate:'' });

  useEffect(()=>{
    const r = ref(db, '/banners');
    const unsub = onValue(r, snap=>{
      const raw = snap.val();
      let arr = [];
      if(!raw) arr = [];
      else if (Array.isArray(raw)) arr = raw.map((b,i)=>({ id: b?.id || `b-${i}`, ...b }));
      else arr = Object.entries(raw).map(([id,b])=>({ id, ...b }));
      setBanners(arr);
      setLoading(false);
    }, e=>{
      console.error('Failed to read /banners', e);
      setBanners([]); setLoading(false);
    });
    return ()=>unsub();
  },[]);

  const addBanner = ()=>{
    if(!newBanner.image){ showToast('Provide image URL','error'); return; }
    const b = {
      id:`b-${Date.now()}`,
      image: normalizeImageUrl(newBanner.image)||newBanner.image,
      heading:newBanner.heading||'',
      body:newBanner.body||'',
      ctaLabel:newBanner.ctaLabel||'',
      link:newBanner.link||'',
      startDate: newBanner.startDate ? new Date(newBanner.startDate).toISOString() : '',
      endDate: newBanner.endDate ? new Date(newBanner.endDate).toISOString() : ''
    };
    setBanners(prev=>[...prev, b]);
    setNewBanner({ image:'', heading:'', body:'', ctaLabel:'', link:'' });
    showToast('Banner added (save)');
  };

  const updateAt = (idx, field, value)=>{
    setBanners(b => { const c = JSON.parse(JSON.stringify(b||[])); if(c[idx]) c[idx][field]=value; return c; });
  };

  const deleteAt = (idx)=>{
    if(!confirm('Delete this banner?')) return;
    setBanners(b => { const c = JSON.parse(JSON.stringify(b||[])); c.splice(idx,1); return c; });
  };

  // Save a single banner to the DB at /banners/{id}
  const saveBannerAt = async (idx) => {
    const b = (banners || [])[idx];
    if(!b) return;
    setOpBusy(true);
    try{
      const payload = {
        id: b.id,
        image: normalizeImageUrl(b.image) || b.image || '',
        heading: b.heading || '',
        body: b.body || '',
        ctaLabel: b.ctaLabel || '',
        link: b.link || '',
        startDate: b.startDate ? new Date(b.startDate).toISOString() : '',
        endDate: b.endDate ? new Date(b.endDate).toISOString() : ''
      };
      await set(ref(db, `/banners/${b.id}`), payload);
      showToast('Banner saved');
    }catch(e){
      console.error('Failed to save banner', e);
      showToast('Failed to save banner', 'error');
    }finally{ setOpBusy(false); }
  };

  const save = async()=>{
    setOpBusy(true);
    try{
      const payload = (banners||[]).reduce((acc,b)=>{
        acc[b.id] = {
          id:b.id,
          image: normalizeImageUrl(b.image)||b.image||'',
          heading:b.heading||'',
          body:b.body||'',
          ctaLabel:b.ctaLabel||'',
          link:b.link||'',
          startDate: b.startDate ? new Date(b.startDate).toISOString() : '',
          endDate: b.endDate ? new Date(b.endDate).toISOString() : ''
        };
        return acc;
      }, {});
      await set(ref(db,'/banners'), payload);
      await set(ref(db,'/banners'), payload);
      showToast('Saved');
    }catch(e){ console.error('Failed to save banners', e); showToast('Failed to save','error'); }
    finally{ setOpBusy(false); }
  };

  if(loading) return <Loader />;

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Banners</h2>
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-600 mb-1">Image URL *</label>
          <input value={newBanner.image} onChange={(e)=>setNewBanner(n=>({...n,image:e.target.value}))} className="w-full border p-2" />
          <div className="mt-2">
            <div className="w-full bg-gray-50 rounded overflow-hidden border">
              <img src={normalizeImageUrl(newBanner.image)||newBanner.image||'/placeholder.jpg'} alt="preview" className="w-full h-40 object-cover" />
            </div>
          </div>
        </div>
        <div className="md:col-span-1">
          <label className="block text-xs text-gray-600 mb-1">Start date</label>
          <input type="datetime-local" value={newBanner.startDate} onChange={(e)=>setNewBanner(n=>({...n,startDate:e.target.value}))} className="w-full border p-2" />
          <label className="block text-xs text-gray-600 mt-3 mb-1">End date</label>
          <input type="datetime-local" value={newBanner.endDate} onChange={(e)=>setNewBanner(n=>({...n,endDate:e.target.value}))} className="w-full border p-2" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Heading</label>
          <input value={newBanner.heading} onChange={(e)=>setNewBanner(n=>({...n,heading:e.target.value}))} className="w-full border p-2" />
          <label className="block text-xs text-gray-600 mt-3 mb-1">Button label</label>
          <input value={newBanner.ctaLabel} onChange={(e)=>setNewBanner(n=>({...n,ctaLabel:e.target.value}))} className="w-full border p-2" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Body</label>
          <textarea value={newBanner.body} onChange={(e)=>setNewBanner(n=>({...n,body:e.target.value}))} className="w-full border p-2 h-24" />
          <label className="block text-xs text-gray-600 mt-3 mb-1">Link</label>
          <input value={newBanner.link} onChange={(e)=>setNewBanner(n=>({...n,link:e.target.value}))} className="w-full border p-2" />
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={addBanner} className="px-3 py-2 bg-green-600 text-white rounded">Add</button>
        <button onClick={save} disabled={opBusy} className="px-3 py-2 bg-blue-600 text-white rounded">Save to DB</button>
      </div>

      <div className="space-y-3">
        {banners.length===0 && <div className="text-sm text-gray-500">No banners configured</div>}
        {banners.map((b,idx)=> (
          <div key={b.id||`b-${idx}`} className="bg-white border rounded p-4 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="w-full md:w-56 flex-shrink-0">
                <div className="h-40 bg-gray-50 rounded overflow-hidden border">
                  <img src={normalizeImageUrl(b.image)||b.image||'/placeholder.jpg'} alt={b.heading||''} className="w-full h-full object-cover" />
                </div>
                <div className="mt-2 text-xs text-gray-500">ID: {b.id}</div>
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700">Image URL</label>
                  <input value={b.image||''} onChange={(e)=>updateAt(idx,'image',e.target.value)} className="w-full border p-2 mb-2" />

                  <label className="block text-xs font-medium text-gray-700">Heading</label>
                  <input value={b.heading||''} onChange={(e)=>updateAt(idx,'heading',e.target.value)} className="w-full border p-2 mb-2" />

                  <label className="block text-xs font-medium text-gray-700">Body / Description</label>
                  <textarea value={b.body||''} onChange={(e)=>updateAt(idx,'body',e.target.value)} className="w-full border p-2 h-24 mb-2" />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-gray-700">Button label</label>
                  <input value={b.ctaLabel||''} onChange={(e)=>updateAt(idx,'ctaLabel',e.target.value)} className="w-full border p-2 mb-2" />

                  <label className="block text-xs font-medium text-gray-700">Link (CTA)</label>
                  <input value={b.link||''} onChange={(e)=>updateAt(idx,'link',e.target.value)} className="w-full border p-2 mb-2" />

                  <label className="block text-xs font-medium text-gray-700">Start date</label>
                  <input type="datetime-local" value={formatForInput(b.startDate)} onChange={(e)=>updateAt(idx,'startDate',e.target.value)} className="w-full border p-2 mb-2" />

                  <label className="block text-xs font-medium text-gray-700">End date</label>
                  <input type="datetime-local" value={formatForInput(b.endDate)} onChange={(e)=>updateAt(idx,'endDate',e.target.value)} className="w-full border p-2" />
                </div>
              </div>

              <div className="flex flex-col gap-2 md:w-36">
                <button onClick={()=>saveBannerAt(idx)} disabled={opBusy} className="w-full px-3 py-2 bg-green-600 text-white rounded">Save</button>
                <button onClick={()=>deleteAt(idx)} className="w-full px-3 py-2 border rounded">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
