import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, set } from 'firebase/database';
import Loader from '../../components/Loader';
import { showToast } from '../../components/Toast';
import AdminCard from './AdminCard';

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
    <AdminCard title="Homepage Configuration" subtitle="Configure dynamic content sections, featured products, and promotional displays">
      {/* Configuration Overview */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-900">{Object.keys(config.days||{}).length}</div>
              <div className="text-sm text-blue-700">Day Configurations</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {Object.keys(config.days || {}).map(d => (
              <button key={`sum-day-${d}`} onClick={()=>{
                const el = document.getElementById(`homeconfig-day-${d}`);
                if(el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full hover:bg-blue-200 transition-colors">{d}</button>
            ))}
            {Object.keys(config.days || {}).length === 0 && <span className="text-xs text-blue-600">No days configured</span>}
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4 border border-yellow-200">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mr-4">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-900">{Object.keys(config.festivals||{}).length}</div>
              <div className="text-sm text-yellow-700">Festival Configurations</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {Object.keys(config.festivals || {}).map(f => (
              <button key={`sum-fest-${f}`} onClick={()=>{
                const el = document.getElementById(`homeconfig-fest-${f}`);
                if(el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }} className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full hover:bg-yellow-200 transition-colors">{f}</button>
            ))}
            {Object.keys(config.festivals || {}).length === 0 && <span className="text-xs text-yellow-600">No festivals configured</span>}
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-900">{availableTags.length}</div>
              <div className="text-sm text-green-700">Available Tags</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xs text-green-600">Used for product filtering</div>
          </div>
        </div>
      </div>

      {/* Available Tags Reference */}
      <div className="mb-6 bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">Available Product Tags</h3>
          </div>
          <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">{availableTags.length} tags</span>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600">These tags are derived from your product catalog. Use them when configuring day and festival mappings below.</p>
        </div>
        
        <div className="max-h-32 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {availableTags.length === 0 ? (
              <div className="text-center py-8 w-full">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <p className="text-gray-500 text-sm">No tags found in products</p>
                <p className="text-xs text-gray-400 mt-1">Add tags to your products to see them here</p>
              </div>
            ) : (
              availableTags.map(tag => (
                <span key={tag} className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-800 text-sm rounded-full border border-blue-200 hover:bg-blue-100 transition-colors cursor-default">
                  {tag}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Day Mappings Section */}
      <div className="mb-8 bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">Day-based Product Mappings</h3>
          </div>
          <div className="flex gap-3">
            <button onClick={()=>{
              const key = window.prompt('Enter day key (e.g. monday)');
              if(!key) return;
              const k = String(key).trim().toLowerCase().replace(/\s+/g,'-');
              if(!k) return;
              setConfig(c => ({ ...(c||{}), days: { ...(c.days||{}), [k]: [] } }));
              showToast('Day added');
            }} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Day
            </button>
            <button onClick={()=>{
              // populate defaults if empty
              const defaults = {
                monday:['healthy','organic','salad'], tuesday:['italian','pasta','snacks'], wednesday:['quick','ready-to-eat','snacks'],
                thursday:['baking','dairy','bakery'], friday:['party','beverages','chips'], saturday:['grill','meat','seafood'], sunday:['family','bulk','groceries']
              };
              setConfig(c => ({ ...(c||{}), days: Object.keys(c?.days||{}).length ? (c.days) : defaults }));
              showToast('Defaults populated (if empty)');
            }} className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Populate Defaults
            </button>
            <button onClick={()=>{ setConfig({ days:{}, festivals:{} }); showToast('Reset locally'); }} className="inline-flex items-center px-3 py-2 text-gray-600 bg-gray-100 text-sm rounded-lg hover:bg-gray-200 transition-colors">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset
            </button>
          </div>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600">Configure which product tags should be featured on specific days of the week. Enter tags as comma-separated values to create dynamic product showcases.</p>
        </div>
        
        <div className="space-y-4">
          {Object.keys(config.days || {}).length === 0 ? (
            <div className="text-center py-12 bg-blue-50 rounded-lg border-2 border-dashed border-blue-200">
              <svg className="w-12 h-12 text-blue-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h4 className="text-lg font-medium text-gray-900 mb-2">No day mappings configured</h4>
              <p className="text-blue-700 text-sm mb-4">Start by adding day mappings to showcase different products on different days</p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={()=>{
                  const defaults = {
                    monday:['healthy','organic','salad'], tuesday:['italian','pasta','snacks'], wednesday:['quick','ready-to-eat','snacks'],
                    thursday:['baking','dairy','bakery'], friday:['party','beverages','chips'], saturday:['grill','meat','seafood'], sunday:['family','bulk','groceries']
                  };
                  setConfig(c => ({ ...(c||{}), days: defaults }));
                  showToast('Default days added');
                }} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Add Default Days
                </button>
                <button onClick={()=>{
                  const key = window.prompt('Enter day name (e.g. monday)');
                  if(!key) return;
                  const k = String(key).trim().toLowerCase();
                  if(!k) return;
                  setConfig(c => ({ ...(c||{}), days: { ...(c.days||{}), [k]: [] } }));
                  showToast('Day added');
                }} className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Custom Day
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Object.entries(config.days || {}).map(([d, vals]) => {
                const keyName = `days.${d}`;
                const dayIcons = {
                  monday: '🌟', tuesday: '🔥', wednesday: '⚡', thursday: '🍞', 
                  friday: '🎉', saturday: '🔥', sunday: '👨‍👩‍👧‍👦'
                };
                
                return (
                  <div id={`homeconfig-day-${d}`} key={d} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200 hover:border-blue-300 transition-all hover:shadow-md">
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center mb-4">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mr-3 shadow-sm">
                            <span className="text-lg">{dayIcons[d] || '📅'}</span>
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900 capitalize">{d}</h4>
                            <span className="text-sm text-blue-700 font-medium">{(Array.isArray(vals) ? vals : []).length} tags configured</span>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-semibold text-gray-800 mb-2">Product Tags</label>
                            <textarea
                              rows={3}
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
                              placeholder="e.g. healthy, organic, salad, vegetables"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors bg-white"
                            />
                            <p className="text-xs text-gray-600 mt-1">Separate multiple tags with commas</p>
                          </div>
                          
                          {Array.isArray(vals) && vals.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-gray-700">Current Tags:</div>
                              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-2 bg-white rounded-lg border">
                                {vals.map((tag, idx) => (
                                  <span key={idx} className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full border border-blue-200 font-medium">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={()=>saveEntry('days', d)} 
                          disabled={opBusy} 
                          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium shadow-sm"
                        >
                          💾 Save
                        </button>
                        <button 
                          onClick={()=>deleteEntry('days', d)} 
                          disabled={opBusy} 
                          className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors font-medium shadow-sm"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Quick Actions for Common Days */}
        {Object.keys(config.days || {}).length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1">Quick Actions</h4>
                <p className="text-xs text-gray-600">Batch operations for all day mappings</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={()=>{
                    Object.keys(config.days || {}).forEach(day => saveEntry('days', day));
                  }}
                  disabled={opBusy}
                  className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  💾 Save All
                </button>
                <button 
                  onClick={()=>{
                    if(window.confirm('Clear all day mappings?')) {
                      setConfig(c => ({ ...c, days: {} }));
                      showToast('All day mappings cleared');
                    }
                  }}
                  className="inline-flex items-center px-3 py-1.5 bg-red-500 text-white text-xs rounded-md hover:bg-red-600 transition-colors"
                >
                  🗑️ Clear All
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Festival Mappings Section */}
      <div className="mb-8 bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">Festival-based Product Mappings</h3>
          </div>
          <div className="flex gap-3">
            <button onClick={()=>{
              const key = window.prompt('Enter festival key (e.g. diwali, christmas)');
              if(!key) return;
              const k = String(key).trim().toLowerCase().replace(/\s+/g,'-');
              if(!k) return;
              setConfig(c => ({ ...(c||{}), festivals: { ...(c.festivals||{}), [k]: [] } }));
              showToast('Festival added');
            }} className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition-colors">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Festival
            </button>
            <button onClick={()=>{
              setConfig(c => ({ ...(c||{}), festivals: Object.keys(c?.festivals||{}).length ? (c.festivals) : { diwali:[], christmas:[], easter:[], newyear:[] } }));
              showToast('Defaults populated (if empty)');
            }} className="inline-flex items-center px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Populate Defaults
            </button>
          </div>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600">Configure which product tags should be featured during specific festivals and holidays. Enter tags as comma-separated values.</p>
        </div>
        
        <div className="space-y-4">
          {Object.keys(config.festivals || {}).length === 0 ? (
            <div className="text-center py-12 bg-yellow-50 rounded-lg border-2 border-dashed border-yellow-200">
              <svg className="w-12 h-12 text-yellow-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <h4 className="text-lg font-medium text-gray-900 mb-2">No festivals configured</h4>
              <p className="text-yellow-700 text-sm mb-4">Add festival mappings to showcase seasonal and holiday products</p>
              <button onClick={()=>{
                setConfig(c => ({ ...(c||{}), festivals: { diwali:[], christmas:[], easter:[], newyear:[], valentine:[], holi:[] } }));
                showToast('Default festivals added');
              }} className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition-colors">
                Add Default Festivals
              </button>
            </div>
          ) : (
            Object.entries(config.festivals || {}).map(([f, vals]) => {
              const keyName = `festivals.${f}`;
              return (
                <div id={`homeconfig-fest-${f}`} key={f} className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 hover:border-yellow-300 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center mb-3">
                        <h4 className="text-base font-semibold text-gray-900 capitalize">{f.replace(/-/g, ' ')}</h4>
                        <span className="ml-2 text-sm text-yellow-700">({(Array.isArray(vals) ? vals : []).length} tags)</span>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Product Tags (comma-separated)</label>
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
                          placeholder="e.g. gifts, decorations, sweets"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-colors"
                        />
                        {Array.isArray(vals) && vals.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {vals.map((tag, idx) => (
                              <span key={idx} className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={()=>saveEntry('festivals', f)} 
                        disabled={opBusy} 
                        className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        Save
                      </button>
                      <button 
                        onClick={()=>deleteEntry('festivals', f)} 
                        disabled={opBusy} 
                        className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Home Sections Visibility */}
      <div className="mb-8 bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center mb-6">
          <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900">Section Visibility Controls</h3>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600">Enable or disable different sections on your homepage. Changes take effect immediately.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {['deals','quickBuys','recommended','popular','festivals'].map(k => {
            const isEnabled = Boolean(config.show && config.show[k]);
            const sectionLabels = {
              deals: { name: 'Deals & Offers', icon: '🏷️', desc: 'Special discounts and promotions' },
              quickBuys: { name: 'Quick Buys', icon: '⚡', desc: 'Fast purchase items' },
              recommended: { name: 'Recommended', icon: '👍', desc: 'Curated product suggestions' },
              popular: { name: 'Popular Items', icon: '🔥', desc: 'Trending and best-selling products' },
              festivals: { name: 'Festival Specials', icon: '🎉', desc: 'Seasonal and holiday items' }
            };
            
            return (
              <div key={`show-${k}`} className={`relative rounded-lg border-2 transition-all ${
                isEnabled 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-gray-200 bg-gray-50'
              }`}>
                <label className="flex items-start p-4 cursor-pointer">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e)=>{
                        const val = !!e.target.checked;
                        updateField(`show.${k}`, val);
                        setOpBusy(true);
                        set(ref(db, `/homeConfig/show/${k}`), val).then(()=>{
                          showToast('Saved');
                        }).catch(err=>{
                          console.error('Failed to save show toggle', err);
                          showToast('Failed to save', 'error');
                        }).finally(()=> setOpBusy(false));
                      }}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                  </div>
                  <div className="ml-3">
                    <div className="flex items-center">
                      <span className="text-lg mr-2">{sectionLabels[k].icon}</span>
                      <div className="text-sm font-medium text-gray-900">{sectionLabels[k].name}</div>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{sectionLabels[k].desc}</div>
                    <div className={`text-xs mt-2 font-medium ${
                      isEnabled ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {isEnabled ? '✓ Enabled' : '○ Disabled'}
                    </div>
                  </div>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Product Collections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {['deals','quickBuys','recommended','popular'].map(key => {
          const vals = config?.[key] || [];
          const bufKey = `top.${key}`;
          
          const collectionInfo = {
            deals: { name: 'Deals & Offers', icon: '🏷️', color: 'red', desc: 'Products with special discounts' },
            quickBuys: { name: 'Quick Buys', icon: '⚡', color: 'blue', desc: 'Fast and convenient purchase items' },
            recommended: { name: 'Recommended Products', icon: '👍', color: 'green', desc: 'Curated product recommendations' },
            popular: { name: 'Popular Items', icon: '🔥', color: 'orange', desc: 'Trending and best-selling products' }
          };
          
          const colorClasses = {
            red: 'border-red-200 bg-red-50',
            blue: 'border-blue-200 bg-blue-50', 
            green: 'border-green-200 bg-green-50',
            orange: 'border-orange-200 bg-orange-50'
          };
          
          return (
            <div key={`top-${key}`} className={`bg-white rounded-xl border border-gray-200 p-6`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${colorClasses[collectionInfo[key].color]}`}>
                    <span className="text-lg">{collectionInfo[key].icon}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{collectionInfo[key].name}</h3>
                    <p className="text-sm text-gray-600">{collectionInfo[key].desc}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={()=> saveTopLevel(key)} 
                    disabled={opBusy} 
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    Save
                  </button>
                  <button 
                    onClick={()=> deleteTopLevel(key)} 
                    disabled={opBusy} 
                    className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product Tags or IDs (comma-separated)
                  </label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors"
                    value={buffers[bufKey] !== undefined ? buffers[bufKey] : (Array.isArray(vals) ? vals.join(',') : '')}
                    onChange={(e)=> setBuffers(b => ({ ...b, [bufKey]: e.target.value }))}
                    onBlur={()=> {
                      const raw = buffers[bufKey] !== undefined ? buffers[bufKey] : (Array.isArray(vals) ? vals.join(',') : '');
                      const arr = String(raw || '').split(',').map(s=>s.trim()).filter(Boolean);
                      updateField(key, arr);
                      setBuffers(b => { const c = {...b}; delete c[bufKey]; return c; });
                    }}
                    placeholder={`Enter tags like "electronics, phones" or product IDs like "PROD001, PROD002"`}
                  />
                </div>
                
                {Array.isArray(vals) && vals.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-700 mb-2">
                      Current tags/IDs ({vals.length}):
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                      {vals.map((tag, idx) => (
                        <span key={idx} className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                          collectionInfo[key].color === 'red' ? 'bg-red-100 text-red-800' :
                          collectionInfo[key].color === 'blue' ? 'bg-blue-100 text-blue-800' :
                          collectionInfo[key].color === 'green' ? 'bg-green-100 text-green-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions Footer */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-200">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Auto-save:</span> Section toggles save immediately
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={()=>{ 
              setConfig({ days:{}, festivals:{}, deals: [], quickBuys: [], recommended: [], popular: [], show: {} }); 
              showToast('Configuration reset locally'); 
            }} 
            className="inline-flex items-center px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset All
          </button>
          
          <button 
            onClick={save} 
            disabled={saving} 
            className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Save Configuration
              </>
            )}
          </button>
        </div>
      </div>
    </AdminCard>
  );
}
