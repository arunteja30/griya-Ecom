import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, get, set } from 'firebase/database';
import Loader from '../../components/Loader';
import { showToast } from '../../components/Toast';

export default function SeedAdmin(){
  const [path, setPath] = useState('/');
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState(false);

  const loadFromDb = async () => {
    try{
      setReading(true);
      const r = ref(db, path);
      const snap = await get(r);
      const val = snap.val();
      setJsonText(val ? JSON.stringify(val, null, 2) : 'null');
      showToast('Loaded data from database');
    }catch(e){
      console.error(e);
      showToast('Failed to load data from database');
    }finally{ setReading(false); }
  };

  const saveToDb = async () => {
    if(!confirm(`Save the JSON into database path "${path}"? This will overwrite data at that path.`)) return;
    let payload;
    try{
      payload = JSON.parse(jsonText);
    }catch(e){
      showToast('Invalid JSON: ' + e.message);
      return;
    }
    try{
      setLoading(true);
      await set(ref(db, path), payload);
      showToast('Saved JSON to database');
    }catch(e){
      console.error(e);
      showToast('Failed to save to database');
    }finally{ setLoading(false); }
  };

  const onFile = (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setJsonText(e.target.result);
      showToast('Loaded JSON file into editor');
    };
    reader.readAsText(f);
  };

  return (
    <div className="max-w-4xl bg-white p-6 rounded shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Seed / JSON Editor</h2>
        <div className="text-sm text-neutral-500">Be careful — this will overwrite data in the Realtime Database for admins only.</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Database Path</label>
          <input value={path} onChange={(e)=>setPath(e.target.value)} className="border p-2 w-full" placeholder="/ (root) or /products or /home/sections" />
        </div>
        <div className="flex gap-2 items-end">
          <button onClick={loadFromDb} disabled={reading} className="px-3 py-2 bg-primary-600 text-white rounded text-sm">Load from DB</button>
          <label className="px-3 py-2 border rounded cursor-pointer text-sm">
            Upload JSON
            <input type="file" accept="application/json" onChange={onFile} className="hidden" />
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">JSON</label>
        <textarea value={jsonText} onChange={(e)=>setJsonText(e.target.value)} rows={18} className="w-full border p-2 font-mono text-sm" />
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={saveToDb} disabled={loading} className="px-4 py-2 btn btn-accent">Save to DB</button>
        <button onClick={()=>{ if(confirm('Clear editor?')) setJsonText(''); }} className="px-4 py-2 border rounded">Clear</button>
        <button onClick={()=>{ setJsonText('// Paste JSON here or load from DB'); }} className="px-4 py-2 border rounded">Insert placeholder</button>
      </div>

      <div className="mt-6 text-sm text-neutral-500">Tip: To restore full seed, open the local file <code>seed/database.seed.json</code> and paste its contents here, then choose a path such as <code>/</code> or specific nodes like <code>/home</code>.</div>
    </div>
  );
}
