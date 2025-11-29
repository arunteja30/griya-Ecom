import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, set } from 'firebase/database';
import Loader from '../../components/Loader';
import { showToast } from '../../components/Toast';

export default function HomeConfigAdmin(){
  const [config, setConfig] = useState({ days: {}, festivals: {}, deals: [], quickBuys: [], recommended: [], popular: [], show: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [opBusy, setOpBusy] = useState(false);
  const [buffers, setBuffers] = useState({}); // keep raw input strings to preserve commas while typing
  const [availableTags, setAvailableTags] = useState([]);

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

  useEffect(()=>{
    const r = ref(db, '/homeConfig');
    return onValue(r, snap => {
      const defaults = { days: {}, festivals: {}, deals: [], quickBuys: [], recommended: [], popular: [], show: {} };
      const raw = snap.val() || {};
      setConfig({ ...defaults, ...raw });
      setLoading(false);
    }, (e)=>{
      console.error('Failed to read /homeConfig', e);
      setLoading(false);
    });
  },[]);

  const updateField = (path, value)=>{
    setConfig(c => {
      const copy = JSON.parse(JSON.stringify(c || { days: {}, festivals: {} }));
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
      await set(ref(db, '/homeConfig'), config);
      showToast('Home config saved');
    }catch(e){
      console.error('Failed to save /homeConfig', e);
      showToast('Failed to save', 'error');
    }finally{ setSaving(false); }
  };

  const saveEntry = async (type, key) => {
    // type = 'days' | 'festivals'
    if(!type || !key) return;
    setOpBusy(true);
    try{
      // if there's a buffer (raw string) for this entry, parse it first and persist that
      const bufKey = `${type}.${key}`;
      let value = (config?.[type] && config[type][key]) ? config[type][key] : null;
      if(buffers[bufKey] !== undefined){
        const parsed = String(buffers[bufKey] || '').split(',').map(s=>s.trim()).filter(Boolean);
        value = parsed;
        // update local config immediately
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
        const copy = JSON.parse(JSON.stringify(c || { days:{}, festivals:{} }));
        if(copy[type]) delete copy[type][key];
        return copy;
      });
      showToast('Deleted');
    }catch(e){
      console.error('Failed to delete entry', e);
      showToast('Failed to delete', 'error');
    }finally{ setOpBusy(false); }
  };

  // helpers for top-level home config keys like deals, quickBuys, recommended, popular, show
  const saveTopLevel = async (key) => {
    if(!key) return;
    setOpBusy(true);
    try{
      const bufKey = `top.${key}`;
      let value = config?.[key] !== undefined ? config[key] : null;
      if(buffers[bufKey] !== undefined){
        const parsed = String(buffers[bufKey] || '').split(',').map(s=>s.trim()).filter(Boolean);
        value = parsed;
        updateField(key, parsed);
        setBuffers(b => { const c = {...b}; delete c[bufKey]; return c; });
      }
      await set(ref(db, `/homeConfig/${key}`), value);
      showToast('Saved');
    }catch(e){
      console.error('Failed to save top-level entry', e);
      showToast('Failed to save', 'error');
    }finally{ setOpBusy(false); }
  };

  const deleteTopLevel = async (key) => {
    if(!confirm(`Delete /homeConfig/${key} ?`)) return;
    setOpBusy(true);
    try{
      await set(ref(db, `/homeConfig/${key}`), null);
      setConfig(c => {
        const copy = JSON.parse(JSON.stringify(c || { days:{}, festivals:{} }));
        if(copy[key] !== undefined) delete copy[key];
        return copy;
      });
      showToast('Deleted');
    }catch(e){
      console.error('Failed to delete top-level entry', e);
      showToast('Failed to delete', 'error');
    }finally{ setOpBusy(false); }
  };

  if(loading) return <Loader />;

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Homepage Configuration</h2>

      {/* Saved summary */}
      <div className="mb-4 p-3 bg-white rounded border">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Saved entries</div>
          <div className="text-xs text-gray-500">Days: {Object.keys(config.days||{}).length} • Festivals: {Object.keys(config.festivals||{}).length}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.keys(config.days || {}).map(d => (
            <button key={`sum-day-${d}`} onClick={()=>{
              const el = document.getElementById(`homeconfig-day-${d}`);
              if(el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }} className="px-2 py-1 bg-gray-100 text-sm rounded">{d}</button>
          ))}
          {Object.keys(config.festivals || {}).map(f => (
            <button key={`sum-fest-${f}`} onClick={()=>{
              const el = document.getElementById(`homeconfig-fest-${f}`);
              if(el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }} className="px-2 py-1 bg-yellow-50 text-sm rounded">{f}</button>
          ))}
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
        <div className="text-xs text-gray-600 mt-2">This list is derived from product tag values in <code>/products</code>. Use these tags when configuring days/festivals.</div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h3 className="font-medium mb-2">Day mappings (dynamic)</h3>
          <div className="flex gap-2">
            <button onClick={()=>{
              const key = window.prompt('Enter day key (e.g. monday)');
              if(!key) return;
              const k = String(key).trim().toLowerCase().replace(/\s+/g,'-');
              if(!k) return;
              setConfig(c => ({ ...(c||{}), days: { ...(c.days||{}), [k]: [] } }));
              showToast('Day added');
            }} className="px-3 py-1 bg-green-600 text-white rounded">Add Day</button>
            <button onClick={()=>{
              // populate defaults if empty
              const defaults = {
                monday:['healthy','organic','salad'], tuesday:['italian','pasta','snacks'], wednesday:['quick','ready-to-eat','snacks'],
                thursday:['baking','dairy','bakery'], friday:['party','beverages','chips'], saturday:['grill','meat','seafood'], sunday:['family','bulk','groceries']
              };
              setConfig(c => ({ ...(c||{}), days: Object.keys(c?.days||{}).length ? (c.days) : defaults }));
              showToast('Defaults populated (if empty)');
            }} className="px-3 py-1 bg-indigo-600 text-white rounded">Populate Defaults</button>
            <button onClick={()=>{ setConfig({ days:{}, festivals:{} }); showToast('Reset locally'); }} className="px-3 py-1 bg-gray-100 rounded">Reset</button>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-2">Manage day keys and their tag lists. Tags should be comma-separated.</p>
        <div className="grid grid-cols-1 gap-3">
          {Object.keys(config.days || {}).length === 0 && <div className="text-sm text-gray-500">No day mappings configured yet.</div>}
          {Object.entries(config.days || {}).map(([d, vals]) => {
            const keyName = `days.${d}`;
            return (
            <div id={`homeconfig-day-${d}`} key={d} className="flex items-center gap-3">
              <div className="w-40 text-sm font-medium">{d.charAt(0).toUpperCase()+d.slice(1)}</div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700">Tags (comma-separated)</label>
                <input
                  value={buffers[keyName] !== undefined ? buffers[keyName] : (Array.isArray(vals) ? vals.join(',') : '')}
                  onChange={(e)=>{
                    const raw = e.target.value;
                    setBuffers(b => ({ ...b, [keyName]: raw }));
                  }}
                  onBlur={(e)=>{
                    const raw = buffers[keyName] !== undefined ? buffers[keyName] : e.target.value;
                    const arr = String(raw || '').split(',').map(s=>s.trim()).filter(Boolean);
                    updateField(`days.${d}`, arr);
                    // clear buffer to fall back to config value
                    setBuffers(b => { const c = {...b}; delete c[keyName]; return c; });
                  }}
                  className="flex-1 border rounded px-3 py-2" />
              </div>
              <div className="flex gap-2">
                <button onClick={()=>saveEntry('days', d)} disabled={opBusy} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
                <button onClick={()=>deleteEntry('days', d)} disabled={opBusy} className="px-3 py-1 bg-red-500 text-white rounded">Delete</button>
              </div>
            </div>
          )})}
        </div>
      </div>

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
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700">Tags (comma-separated)</label>
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
              </div>
              <div className="flex gap-2">
                <button onClick={()=>saveEntry('festivals', f)} disabled={opBusy} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
                <button onClick={()=>deleteEntry('festivals', f)} disabled={opBusy} className="px-3 py-1 bg-red-500 text-white rounded">Delete</button>
              </div>
            </div>
          )})}
        </div>
      </div>

      {/* Home sections: show toggles */}
      <div className="mb-6">
        <h3 className="font-medium mb-2">Home sections (toggles)</h3>
        <p className="text-sm text-gray-600 mb-2">Enable or disable sections on the homepage.</p>
        <div className="flex gap-3 flex-wrap items-center">
          {['deals','quickBuys','recommended','popular','festivals'].map(k => (
            <label key={`show-${k}`} className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded">
              <input
                type="checkbox"
                checked={Boolean(config.show && config.show[k])}
                onChange={(e)=>{
                  const val = !!e.target.checked;
                  // update local state immediately
                  updateField(`show.${k}`, val);
                  // persist immediately so HomePage reacts without requiring Save
                  setOpBusy(true);
                  set(ref(db, `/homeConfig/show/${k}`), val).then(()=>{
                    showToast('Saved');
                  }).catch(err=>{
                    console.error('Failed to save show toggle', err);
                    showToast('Failed to save', 'error');
                  }).finally(()=> setOpBusy(false));
                }}
              />
               <span className="text-sm">{k}</span>
             </label>
           ))}
         </div>
       </div>

      {/* Top-level lists */}
      {['deals','quickBuys','recommended','popular'].map(key => {
        const vals = config?.[key] || [];
        const bufKey = `top.${key}`;
        return (
          <div key={`top-${key}`} className="mb-6">
            <div className="flex items-center justify-between">
              <h3 className="font-medium mb-2">{key.charAt(0).toUpperCase()+key.slice(1)}</h3>
              <div className="flex gap-2">
                <button onClick={()=> saveTopLevel(key)} disabled={opBusy} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
                <button onClick={()=> deleteTopLevel(key)} disabled={opBusy} className="px-3 py-1 bg-red-500 text-white rounded">Delete</button>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-2">Comma-separated tags or product IDs used for the <strong>{key}</strong> section.</p>
            <div className="flex items-center gap-3">
              <input
                className="flex-1 border rounded px-3 py-2"
                value={buffers[bufKey] !== undefined ? buffers[bufKey] : (Array.isArray(vals) ? vals.join(',') : '')}
                onChange={(e)=> setBuffers(b => ({ ...b, [bufKey]: e.target.value }))}
                onBlur={()=> {
                  const raw = buffers[bufKey] !== undefined ? buffers[bufKey] : (Array.isArray(vals) ? vals.join(',') : '');
                  const arr = String(raw || '').split(',').map(s=>s.trim()).filter(Boolean);
                  updateField(key, arr);
                  setBuffers(b => { const c = {...b}; delete c[bufKey]; return c; });
                }}
              />
              <button onClick={()=> saveTopLevel(key)} className="px-3 py-1 bg-green-600 text-white rounded">Save</button>
            </div>
          </div>
        );
      })}

      <div className="flex gap-3">
        <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
        <button onClick={()=>{ setConfig({ days:{}, festivals:{}, deals: [], quickBuys: [], recommended: [], popular: [], show: {} }); showToast('Reset locally'); }} className="px-4 py-2 bg-gray-100 rounded">Reset</button>
      </div>
    </div>
  );
}
