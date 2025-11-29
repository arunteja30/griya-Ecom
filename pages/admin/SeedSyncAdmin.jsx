import React, { useState } from 'react';
import { ref, set, update, get } from 'firebase/database';
import { db } from '../../firebase';
import { showToast } from '../../components/Toast';

export default function SeedSyncAdmin(){
  const [jsonText, setJsonText] = useState('');
  const [status, setStatus] = useState(null);
  const [fileName, setFileName] = useState('');
  const [mergeMode, setMergeMode] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setJsonText(String(e.target.result || ''));
      showToast('File loaded into editor');
    };
    reader.onerror = () => showToast('Failed to read file', 'error');
    reader.readAsText(file, 'utf-8');
  };

  const onFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    handleFile(f);
  };

  const importSeed = async () => {
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      showToast('Invalid JSON', 'error');
      return;
    }

    setStatus('saving');
    try {
      if (mergeMode) {
        // Merge top-level keys using update so existing keys are preserved when possible
        await update(ref(db, '/'), parsed);
      } else {
        // Overwrite: write each top-level key to the database (same behaviour as earlier)
        for (const key of Object.keys(parsed)) {
          await set(ref(db, `/${key}`), parsed[key]);
        }
      }

      setStatus('saved');
      showToast('Seed imported successfully');
    } catch (err) {
      console.error(err);
      setStatus('error');
      showToast('Error importing seed', 'error');
    }
  };

  // fetch DB contents into editor
  const fetchDb = async () => {
    try{
      setStatus('fetching');
      const snap = await get(ref(db, '/'));
      const val = snap.exists() ? snap.val() : {};
      setJsonText(JSON.stringify(val, null, 2));
      setStatus('fetched');
      showToast('Database fetched into editor');
    }catch(e){
      console.error(e);
      setStatus('error');
      showToast('Failed to fetch database', 'error');
    }
  };

  return (
    <div className="max-w-4xl bg-white p-6 rounded shadow">
      <h2 className="text-lg font-semibold mb-4">Seed Sync</h2>
      <p className="text-sm text-gray-600 mb-4">Load a seed JSON file or paste it below, then click Import. Merge mode updates top-level keys instead of overwriting them.</p>

      <div className="flex items-center gap-3 mb-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Seed file</label>
          <input type="file" accept="application/json" onChange={onFileChange} />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={mergeMode} onChange={(e)=>setMergeMode(e.target.checked)} />
            Merge (update) instead of overwrite
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Seed JSON</label>
        <textarea value={jsonText} onChange={(e)=>setJsonText(e.target.value)} className="w-full h-64 border p-3 mb-4" placeholder="Paste seed JSON here" />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={fetchDb} className="bg-gray-800 text-white px-4 py-2 rounded">Fetch DB</button>
        <button onClick={importSeed} className="bg-black text-white px-4 py-2 rounded">Import</button>
        {status==='fetching' && <span className="text-sm text-neutral-600">Fetching...</span>}
        {status==='fetched' && <span className="text-green-600">Fetched</span>}
        {status==='saving' && <span className="text-neutral-600">Saving...</span>}
        {status==='saved' && <span className="text-green-600">Imported</span>}
        {status==='error' && <span className="text-red-600">Error</span>}
      </div>
    </div>
  );
}
