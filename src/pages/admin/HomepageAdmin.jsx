import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, set } from 'firebase/database';
import Loader from '../../components/Loader';
import { showToast } from '../../components/Toast';
import { Link } from 'react-router-dom';
import { normalizeImageUrl } from '../../utils/imageHelpers';

export default function HomepageAdmin(){
  const [config, setConfig] = useState({ festivals: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [opBusy, setOpBusy] = useState(false);
  const [buffers, setBuffers] = useState({}); // keep raw input strings to preserve commas while typing
  const [availableTags, setAvailableTags] = useState([]);
  const [banners, setBanners] = useState([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [newBanner, setNewBanner] = useState({ image: '', heading: '', body: '', ctaLabel: '', link: '' });
  // admin debug / save options
  const [saveAsArray, setSaveAsArray] = useState(false);
  const [savePreviewOpen, setSavePreviewOpen] = useState(false);

  // subscribe to products and derive unique normalized tags for admin debugging
  useEffect(()=>{
    const r = ref(db, '/products');
    const unsub = onValue(r, snap => {
      const raw = snap.val() || {};
      const tagsSet = new Set();
      Object.values(raw).forEach(p => {
        const t = p?.tags;
        if (!t) return;
        const arr = Array.isArray(t) ? t : String(t).split(',');
        arr.map(x => String(x || '').trim().toLowerCase()).filter(Boolean).forEach(tag => tagsSet.add(tag));
      });
      setAvailableTags(Array.from(tagsSet).sort());
    }, (e)=>{
      console.error('Failed to read /products for tags', e);
      setAvailableTags([]);
    });
    return () => unsub();
  }, []);

  // subscribe to /homeConfig for festivals
  useEffect(()=>{
    const r = ref(db, '/homeConfig');
    return onValue(r, snap => {
      const val = snap.val() || {};
      setConfig({ festivals: val.festivals || {} });
      setLoading(false);
    }, (e)=>{
      console.error('Failed to read /homeConfig', e);
      setLoading(false);
    });
  },[]);

  // subscribe to /banners for basic banner management
  useEffect(()=>{
    const r = ref(db, '/banners');
    const unsub = onValue(r, snap => {
      const raw = snap.val();
      let arr = [];
      if (!raw) arr = [];
      else if (Array.isArray(raw)) arr = raw.map((b, i) => ({ id: b?.id || `b-${i}`, ...b }));
      else arr = Object.entries(raw).map(([id,b]) => ({ id, ...b }));
      setBanners(arr);
      setBannersLoading(false);
    }, (e)=>{
      console.error('Failed to read /banners', e);
      setBanners([]);
      setBannersLoading(false);
    });
    return () => unsub();
  }, []);

  const updateField = (path, value)=>{
    setConfig(c => {
      const copy = JSON.parse(JSON.stringify(c || { festivals: {} }));
      const parts = path.split('.');
      let cur = copy;
      for(let i=0;i<parts.length-1;i++){
        cur = cur[parts[i]] = cur[parts[i]] || {};
      }
      cur[parts[parts.length-1]] = value;
      return copy;
    });
  };

  const save = async ()=>{
    setSaving(true);
    try{
      // Only persist festivals here (we manage banners separately)
      await set(ref(db, '/homeConfig/festivals'), config.festivals || {});
      showToast('Festival config saved');
    }catch(e){
      console.error('Failed to save /homeConfig/festivals', e);
      showToast('Failed to save', 'error');
    }finally{ setSaving(false); }
  };

  const saveEntry = async (type, key) => {
    if(!type || !key) return;
    setOpBusy(true);
    try{
      const bufKey = `${type}.${key}`;
      let value = (config?.[type] && config[type][key]) ? config[type][key] : null;
      if(buffers[bufKey] !== undefined){
        const parsed = String(buffers[bufKey] || '').split(',').map(s=>s.trim()).filter(Boolean);
        value = parsed;
        updateField(`${type}.${key}`, parsed);
      }
      await set(ref(db, `/homeConfig/${type}/${key}`), value);
      showToast('Saved');
    }catch(e){
      console.error('Failed to save entry', e);
      showToast('Failed to save', 'error');
    }finally{ setOpBusy(false); }
  };

  const deleteEntry = async (type, key) => {
    if(!confirm(`Delete ${type}/${key} from server? This cannot be undone.`)) return;
    setOpBusy(true);
    try{
      await set(ref(db, `/homeConfig/${type}/${key}`), null);
      // also remove locally
      setConfig(c => {
        const copy = JSON.parse(JSON.stringify(c || { festivals:{} }));
        if(copy[type]) delete copy[type][key];
        return copy;
      });
      showToast('Deleted');
    }catch(e){
      console.error('Failed to delete entry', e);
      showToast('Failed to delete', 'error');
    }finally{ setOpBusy(false); }
  };

  // Banner management helpers
  const saveBanners = async () => {
    setOpBusy(true);
    try{
      // Build payload depending on admin choice (array vs object)
      const normalized = (banners || []).map(b => ({
        id: b?.id || `b-${Date.now()}`,
        image: normalizeImageUrl(b?.image) || b?.image || '',
        heading: b?.heading || '',
        body: b?.body || '',
        ctaLabel: b?.ctaLabel || '',
        link: b?.link || ''
      }));

      const payload = saveAsArray ? normalized : normalized.reduce((acc, b) => { acc[b.id] = b; return acc; }, {});

      console.log('Saving /banners payload:', payload);
      await set(ref(db, '/banners'), payload);
      showToast('Banners saved');
    }catch(e){
      console.error('Failed to save banners', e);
      showToast(`Failed to save banners: ${e?.message || e}`, 'error');
    }finally{ setOpBusy(false); }
  };

  const addBannerFromForm = () => {
    if(!newBanner.image) { showToast('Please provide an image URL', 'error'); return; }
    const id = `b-${Date.now()}`;
    const banner = {
      id,
      image: normalizeImageUrl(newBanner.image) || newBanner.image,
      heading: newBanner.heading || '',
      body: newBanner.body || '',
      ctaLabel: newBanner.ctaLabel || '',
      link: newBanner.link || ''
    };
    setBanners(b => ([...b, banner]));
    setNewBanner({ image: '', heading: '', body: '', ctaLabel: '', link: '' });
    showToast('Banner added (save to persist)');
  };

  const clearNewBannerForm = () => setNewBanner({ image: '', heading: '', body: '', ctaLabel: '', link: '' });

  const updateBannerAt = (idx, field, value) => {
    setBanners(b => {
      const copy = JSON.parse(JSON.stringify(b || []));
      if(copy[idx]) copy[idx][field] = value;
      return copy;
    });
  };

  const deleteBannerAt = (idx) => {
    if(!confirm('Delete this banner?')) return;
    setBanners(b => {
      const copy = JSON.parse(JSON.stringify(b || []));
      copy.splice(idx, 1);
      return copy;
    });
  };

  if(loading || bannersLoading) return <Loader />;

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Homepage Configuration</h2>

      {/* Saved summary */}
      <div className="mb-4 p-3 bg-white rounded border">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Saved entries</div>
          <div className="text-xs text-gray-500">Festivals: {Object.keys(config.festivals||{}).length} • Banners: {banners.length}</div>
        </div>
      </div>

      {/* Debug: available tags in system (derived from /products) */}
      <div className="mb-4 p-3 bg-yellow-50 rounded border border-yellow-100 text-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">Available product tags</div>
          <div className="text-xs text-gray-500">{availableTags.length} tags</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableTags.length === 0 ? (
            <div className="text-xs text-gray-500">No tags found in products</div>
          ) : (
            availableTags.map(tag => (
              <span key={tag} className="px-2 py-1 bg-white border rounded text-xs">{tag}</span>
            ))
          )}
        </div>
        <div className="text-xs text-gray-600 mt-2">This list is derived from product tag values in <code>/products</code>. Use these tags when configuring festivals.</div>
      </div>

      {/* Festival mappings (dynamic) */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h3 className="font-medium mb-2">Festival mappings (dynamic)</h3>
          <div className="flex gap-2">
            <button onClick={()=>{
              const key = window.prompt('Enter festival key (e.g. diwali, christmas)');
              if(!key) return;
              const k = String(key).trim().toLowerCase().replace(/\s+/g,'-');
              if(!k) return;
              setConfig(c => ({ ...(c||{}), festivals: { ...(c.festivals||{}), [k]: [] } }));
              showToast('Festival added');
            }} className="px-3 py-1 bg-green-600 text-white rounded">Add Festival</button>
            <button onClick={()=>{
              setConfig(c => ({ ...(c||{}), festivals: Object.keys(c?.festivals||{}).length ? (c.festivals) : { diwali:[], christmas:[], easter:[], newyear:[] } }));
              showToast('Defaults populated (if empty)');
            }} className="px-3 py-1 bg-indigo-600 text-white rounded">Populate Defaults</button>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-2">Manage festival keys and their tag lists. Tags should be comma-separated.</p>
        <div className="grid grid-cols-1 gap-3">
          {Object.keys(config.festivals || {}).length === 0 && <div className="text-sm text-gray-500">No festivals configured yet.</div>}
          {Object.entries(config.festivals || {}).map(([f, vals]) => {
            const keyName = `festivals.${f}`;
            return (
            <div id={`homeconfig-fest-${f}`} key={f} className="flex items-center gap-3">
              <div className="w-40 text-sm font-medium">{f.charAt(0).toUpperCase()+f.slice(1)}</div>
              <input
                value={buffers[keyName] !== undefined ? buffers[keyName] : (Array.isArray(vals) ? vals.join(',') : '')}
                onChange={(e)=>{
                  const raw = e.target.value;
                  setBuffers(b => ({ ...b, [keyName]: raw }));
                }}
                onBlur={(e)=>{
                  const raw = buffers[keyName] !== undefined ? buffers[keyName] : e.target.value;
                  const arr = String(raw || '').split(',').map(s=>s.trim()).filter(Boolean);
                  updateField(`festivals.${f}`, arr);
                  setBuffers(b => { const c = {...b}; delete c[keyName]; return c; });
                }}
                className="flex-1 border rounded px-3 py-2" />
              <div className="flex gap-2">
                <button onClick={()=>saveEntry('festivals', f)} disabled={opBusy} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
                <button onClick={()=>deleteEntry('festivals', f)} disabled={opBusy} className="px-3 py-1 bg-red-500 text-white rounded">Delete</button>
              </div>
            </div>
          )})}
        </div>
      </div>

      {/* Banner management */}
      <div className="mb-6 p-4 bg-white rounded border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Banners</h3>
          <div className="text-sm text-gray-500">Manage homepage banners separately</div>
        </div>
        <div>
          <p className="text-sm text-gray-600">Banners have moved to a dedicated admin page.</p>
          <Link to="/admin/banners" className="inline-block mt-3 px-3 py-2 bg-blue-600 text-white rounded">Open Banners Admin</Link>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{saving ? 'Saving...' : 'Save Festivals'}</button>
        <button onClick={()=>{ setConfig({ festivals:{} }); showToast('Reset locally'); }} className="px-4 py-2 bg-gray-100 rounded">Reset</button>
      </div>
    </div>
  );
}