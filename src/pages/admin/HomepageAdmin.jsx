import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, update } from 'firebase/database';
import Loader from '../../components/Loader';
import { showToast } from '../../components/Toast';

export default function HomepageAdmin(){
  const [home, setHome] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

      {Object.keys(sections).length === 0 ? (
        <div className="p-4 border rounded bg-yellow-50">No sections found under <code>/home/sections</code>. Use the seed or create sections in the admin UI.</div>
      ) : (
        Object.entries(sections).map(([sid, sec])=> (
          <div key={sid} className="mb-4">
            <h3 className="font-semibold">{sec?.title || sid}</h3>
            <div className="grid grid-cols-3 gap-2 mt-2">
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
          </div>
        ))
      )}
    </div>
  );
}
