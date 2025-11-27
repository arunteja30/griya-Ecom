import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, update, set } from 'firebase/database';
import Loader from '../../components/Loader';
import { showToast } from '../../components/Toast';

export default function HomepageAdmin(){
  const [home, setHome] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingVisibility, setEditingVisibility] = useState(null);
  const [visibilityForm, setVisibilityForm] = useState({ type: 'always', start: '', end: '', festivals: [] });
  const [activeFestivalsText, setActiveFestivalsText] = useState('');
  const [editingCarousel, setEditingCarousel] = useState(null);
  const [carouselFormSlides, setCarouselFormSlides] = useState([]);
  // New: create homepage section UI (carousel etc.)
  const [newSectionId, setNewSectionId] = useState('');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionType, setNewSectionType] = useState('carousel');
  const [newVisibilityType, setNewVisibilityType] = useState('always');
  const [newVisibilityStart, setNewVisibilityStart] = useState('');
  const [newVisibilityEnd, setNewVisibilityEnd] = useState('');

  useEffect(()=>{
    const r = ref(db, '/home');
    return onValue(r, snap=>{
      try{
        setHome(snap.val() || null);
        setLoading(false);
      }catch(e){
        console.error('Failed to read /home', e);
        setError(e);
        setLoading(false);
      }
    }, (e)=>{
      console.error('Firebase error /home', e);
      setError(e);
      setLoading(false);
    });
  },[]);

  const openEditCarousel = (sid, slides) => {
    setEditingCarousel(sid);
    const norm = (slides || []).map(s => (typeof s === 'string' ? { image: s, title: '', subtitle: '', buttonText: '', buttonUrl: '' } : ({ image: s.image || '', title: s.title || '', subtitle: s.subtitle || s.body || '', buttonText: s.buttonText || '', buttonUrl: s.buttonUrl || '' })));
    setCarouselFormSlides(norm);
  };

  const updateCarouselSlideField = (idx, key, value) => {
    setCarouselFormSlides(prev => prev.map((s, i) => i === idx ? { ...s, [key]: value } : s));
  };

  const addCarouselSlide = () => setCarouselFormSlides(prev => [...prev, { image: '', title: '', subtitle: '', buttonText: '', buttonUrl: '' }]);
  const removeCarouselSlide = (idx) => setCarouselFormSlides(prev => prev.filter((_, i) => i !== idx));

  const saveCarouselSlides = async (sid) => {
    try{
      // Save the slides array to /home/sections/{sid}/images
      const arr = carouselFormSlides.map(s => ({ image: s.image || '', title: s.title || '', subtitle: s.subtitle || '', buttonText: s.buttonText || '', buttonUrl: s.buttonUrl || '' }));
      await update(ref(db, `/home/sections/${sid}`), { images: arr });
      showToast('Carousel slides saved');
      setEditingCarousel(null);
      setCarouselFormSlides([]);
    }catch(e){
      console.error('Failed to save carousel slides', e);
      showToast('Failed to save carousel slides');
    }
  };

  useEffect(()=>{
    if(home?.activeFestivals) setActiveFestivalsText((home.activeFestivals || []).join(','));
  }, [home]);

  const saveActiveFestivals = async ()=>{
    try{
      const arr = activeFestivalsText.split(',').map(s=>s.trim()).filter(Boolean);
      await update(ref(db, '/home'), { activeFestivals: arr });
      showToast('Active festivals updated');
    }catch(e){ console.error(e); showToast('Failed to update active festivals'); }
  };

  const toggleFeatured = async (sectionId, productId, enabled)=>{
    try{
      const path = `/home/sections/${sectionId}/items/${productId}`;
      if(enabled){
        await update(ref(db, path), { featured: true });
      } else {
        await update(ref(db, path), { featured: null });
      }
      showToast(enabled ? 'Added to section' : 'Removed from section');
    }catch(e){
      console.error(e);
      showToast('Error updating section');
    }
  };

  const openEditVisibility = (sid, vis)=>{
    setEditingVisibility(sid);
    setVisibilityForm({ type: vis?.type || 'always', start: vis?.start || '', end: vis?.end || '', festivals: (vis?.festivals || []).join(',') });
  };

  const saveVisibility = async (sid)=>{
    try{
      const payload = { type: visibilityForm.type };
      if(visibilityForm.type === 'time'){
        if(visibilityForm.start) payload.start = visibilityForm.start;
        if(visibilityForm.end) payload.end = visibilityForm.end;
      }
      if(visibilityForm.type === 'festival'){
        payload.festivals = visibilityForm.festivals.split(',').map(s=>s.trim()).filter(Boolean);
      }
      await update(ref(db, `/home/sections/${sid}`), { visibility: payload });
      showToast('Visibility saved');
      setEditingVisibility(null);
    }catch(e){ console.error(e); showToast('Failed to save visibility'); }
  };

  const createSection = async () => {
    const idRaw = (newSectionId || '').trim();
    const title = (newSectionTitle || '').trim();
    if(!title){ showToast('Provide a section title'); return; }
    const id = idRaw || title.toLowerCase().replace(/\s+/g,'-');
    if(home?.sections && home.sections[id]){ showToast('Section id already exists'); return; }
    try{
      const payload = { title, type: newSectionType, images: [], items: {} };
      if(newVisibilityType && newVisibilityType !== 'always'){
        if(newVisibilityType === 'time'){
          payload.visibility = { type: 'time' };
          if(newVisibilityStart) payload.visibility.start = newVisibilityStart;
          if(newVisibilityEnd) payload.visibility.end = newVisibilityEnd;
        } else if(newVisibilityType === 'festival'){
          payload.visibility = { type: 'festival', festivals: [] };
        }
      }
      await set(ref(db, `/home/sections/${id}`), payload);
      showToast('Section created');
      // reset
      setNewSectionId(''); setNewSectionTitle(''); setNewSectionType('carousel'); setNewVisibilityType('always'); setNewVisibilityStart(''); setNewVisibilityEnd('');
    }catch(e){ console.error('Failed to create section', e); showToast('Failed to create section'); }
  };

  if(loading) return <Loader />;
  if(error) return <div className="text-red-600">Error loading homepage admin. Check console for details.</div>;

  if(!home){
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Homepage sections</h2>
        <div className="p-4 border rounded bg-yellow-50">
          <p className="mb-2">No homepage configuration found at <code>/home</code> in the Realtime Database.</p>
          <p className="text-sm text-gray-700">You can create the initial structure by adding a `home` node with a `hero` and `sections` object. Example payload is available in <code>seed/database.seed.json</code>.</p>
          <p className="mt-2 text-sm">If you are logged in as admin and still see this, ensure your database rules permit reading `/home` and that the admin user has the correct custom claim.</p>
        </div>
      </div>
    );
  }

  const sections = home?.sections ?? {};

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Homepage sections</h2>

      <div className="mb-4 p-4 border rounded bg-white">
        <h3 className="font-medium mb-2">Global dynamic settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Active festivals (comma separated)</label>
            <input value={activeFestivalsText} onChange={(e)=>setActiveFestivalsText(e.target.value)} className="border p-2 w-full" placeholder="e.g. diwali, navratri" />
          </div>
          <div className="flex gap-2">
            <button onClick={saveActiveFestivals} className="px-3 py-2 bg-primary-600 text-white rounded text-sm">Save festivals</button>
            <button onClick={()=>setActiveFestivalsText('')} className="px-3 py-2 border rounded text-sm">Clear</button>
          </div>
        </div>
      </div>

      {/* New: create homepage section (carousel etc.) */}
      <div className="mb-4 p-4 border rounded bg-white">
        <h3 className="font-medium mb-2">Create new homepage section</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <label className="block text-sm font-medium mb-1">Section ID (optional)</label>
            <input value={newSectionId} onChange={(e)=>setNewSectionId(e.target.value)} className="border p-2 w-full" placeholder="section-id (auto from title)" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input value={newSectionTitle} onChange={(e)=>setNewSectionTitle(e.target.value)} className="border p-2 w-full" placeholder="Section title" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select value={newSectionType} onChange={(e)=>setNewSectionType(e.target.value)} className="border p-2 w-full">
              <option value="carousel">Carousel</option>
              <option value="grid">Grid</option>
              <option value="hero">Hero</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Visibility</label>
            <select value={newVisibilityType} onChange={(e)=>setNewVisibilityType(e.target.value)} className="border p-2 w-full">
              <option value="always">Always</option>
              <option value="time">Time window</option>
              <option value="festival">Festival</option>
            </select>
          </div>
          {newVisibilityType === 'time' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Start (local)</label>
                <input type="datetime-local" value={newVisibilityStart} onChange={(e)=>setNewVisibilityStart(e.target.value)} className="border p-2 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End (local)</label>
                <input type="datetime-local" value={newVisibilityEnd} onChange={(e)=>setNewVisibilityEnd(e.target.value)} className="border p-2 w-full" />
              </div>
            </>
          )}
          <div className="md:col-span-3 flex gap-2">
            <button onClick={createSection} className="px-3 py-2 bg-primary-600 text-white rounded">Create section</button>
            <button onClick={()=>{ setNewSectionId(''); setNewSectionTitle(''); setNewSectionType('carousel'); setNewVisibilityType('always'); setNewVisibilityStart(''); setNewVisibilityEnd(''); }} className="px-3 py-2 border rounded">Clear</button>
          </div>
        </div>
      </div>

      {Object.keys(sections).length === 0 ? (
        <div className="p-4 border rounded bg-yellow-50">No sections found under <code>/home/sections</code>. Use the seed or create sections in the admin UI.</div>
      ) : (
        Object.entries(sections).map(([sid, sec])=> (
          <div key={sid} className="mb-4">
            <h3 className="font-semibold">{sec?.title || sid}</h3>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="col-span-3 mb-2 text-sm text-neutral-600">Visibility: {sec.visibility ? JSON.stringify(sec.visibility) : 'always'}</div>
               {Object.entries(sec?.items ?? {}).length === 0 ? (
                 <div className="text-sm text-gray-600">No items in this section.</div>
               ) : (
                 Object.entries(sec.items ?? {}).map(([pid, it])=> (
                   <div key={pid} className="p-2 border rounded flex items-center justify-between">
                     <div>{it?.name || it?.title || pid}</div>
                     <div className="flex gap-2">
                       <button onClick={()=>toggleFeatured(sid, pid, true)} className="text-green-600">Add</button>
                       <button onClick={()=>toggleFeatured(sid, pid, false)} className="text-red-600">Remove</button>
                     </div>
                   </div>
                 ))
               )}
            </div>

            <div className="mt-2 flex gap-2">
              <button onClick={()=>openEditVisibility(sid, sec.visibility)} className="px-3 py-1 border rounded text-sm">Edit visibility</button>
              { (sec.type === 'carousel' || (sec.images && Array.isArray(sec.images))) && (
                 <button onClick={()=>openEditCarousel(sid, sec.images)} className="px-3 py-1 border rounded text-sm">Edit carousel slides</button>
              )}
              <button onClick={async ()=>{ if(!confirm('Clear visibility for this section?')) return; await update(ref(db, `/home/sections/${sid}`), { visibility: null }); showToast('Visibility cleared'); }} className="px-3 py-1 border rounded text-sm">Clear visibility</button>
            </div>

            {editingVisibility === sid && (
              <div className="mt-3 p-3 border rounded bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select value={visibilityForm.type} onChange={(e)=>setVisibilityForm(f=>({...f, type:e.target.value}))} className="border p-2 w-full">
                      <option value="always">Always</option>
                      <option value="time">Time window</option>
                      <option value="festival">Festival</option>
                    </select>
                  </div>
                  {visibilityForm.type === 'time' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-1">Start (local)</label>
                        <input type="datetime-local" value={visibilityForm.start} onChange={(e)=>setVisibilityForm(f=>({...f, start:e.target.value}))} className="border p-2 w-full" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">End (local)</label>
                        <input type="datetime-local" value={visibilityForm.end} onChange={(e)=>setVisibilityForm(f=>({...f, end:e.target.value}))} className="border p-2 w-full" />
                      </div>
                    </>
                  )}
                  {visibilityForm.type === 'festival' && (
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium mb-1">Festivals (comma separated)</label>
                      <input value={visibilityForm.festivals} onChange={(e)=>setVisibilityForm(f=>({...f, festivals:e.target.value}))} className="border p-2 w-full" placeholder="diwali, navratri" />
                    </div>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={()=>saveVisibility(sid)} className="px-3 py-2 bg-primary-600 text-white rounded">Save visibility</button>
                  <button onClick={()=>setEditingVisibility(null)} className="px-3 py-2 border rounded">Cancel</button>
                </div>
              </div>
            )}

            {editingCarousel === sid && (
              <div className="mt-3 p-3 border rounded bg-white">
                <h4 className="font-medium mb-2">Edit slides for {sec?.title || sid}</h4>
                {carouselFormSlides.length === 0 && <div className="text-sm text-neutral-500 mb-2">No slides defined.</div>}
                <div className="space-y-3">
                  {carouselFormSlides.map((s, idx) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
                        <div className="md:col-span-3">
                          <label className="block text-sm font-medium">Image URL</label>
                          <input value={s.image} onChange={(e)=>updateCarouselSlideField(idx, 'image', e.target.value)} className="border p-2 w-full" />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-sm font-medium">Title</label>
                          <input value={s.title} onChange={(e)=>updateCarouselSlideField(idx, 'title', e.target.value)} className="border p-2 w-full" />
                        </div>
                        <div className="md:col-span-6 mt-2">
                          <label className="block text-sm font-medium">Subtitle / Body</label>
                          <input value={s.subtitle} onChange={(e)=>updateCarouselSlideField(idx, 'subtitle', e.target.value)} className="border p-2 w-full" />
                        </div>
                        <div className="md:col-span-3 mt-2">
                          <label className="block text-sm font-medium">Button text</label>
                          <input value={s.buttonText} onChange={(e)=>updateCarouselSlideField(idx, 'buttonText', e.target.value)} className="border p-2 w-full" />
                        </div>
                        <div className="md:col-span-3 mt-2">
                          <label className="block text-sm font-medium">Button URL</label>
                          <input value={s.buttonUrl} onChange={(e)=>updateCarouselSlideField(idx, 'buttonUrl', e.target.value)} className="border p-2 w-full" />
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button onClick={()=>removeCarouselSlide(idx)} className="px-3 py-1 border text-red-600">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={addCarouselSlide} className="px-3 py-2 border rounded text-sm">Add slide</button>
                  <button onClick={()=>saveCarouselSlides(sid)} className="px-3 py-2 bg-primary-600 text-white rounded text-sm">Save slides</button>
                  <button onClick={()=>{ setEditingCarousel(null); setCarouselFormSlides([]); }} className="px-3 py-2 border rounded text-sm">Cancel</button>
                </div>
              </div>
            )}

          </div>
        ))
      )}
    </div>
  );
}
