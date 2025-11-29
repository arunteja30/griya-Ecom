import React, { useState } from 'react';
import { useFirebaseList } from '../../hooks/useFirebase';
import BannerForm from '../../components/BannerForm';
import { db } from '../../firebase';
import { ref, push, update, remove } from 'firebase/database';

export default function BannersAdmin() {
  const { data: bannersData } = useFirebaseList('/banners');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const list = React.useMemo(() => {
    if (!bannersData) return [];
    if (Array.isArray(bannersData)) return bannersData.map((b, i) => ({ id: b.id || `b-${i}`, ...b }));
    return Object.entries(bannersData).map(([id, b]) => ({ id, ...b }));
  }, [bannersData]);

  const handleCreate = async (values) => {
    setBusy(true);
    try {
      const nodeRef = ref(db, '/banners');
      await push(nodeRef, values);
      setEditing(null);
    } catch (e) {
      console.error('Failed to create banner', e);
      alert('Failed to create banner');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (id, values) => {
    setBusy(true);
    try {
      const nodeRef = ref(db, `/banners/${id}`);
      await update(nodeRef, values);
      setEditing(null);
    } catch (e) {
      console.error('Failed to update banner', e);
      alert('Failed to update banner');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this banner?')) return;
    setBusy(true);
    try {
      const nodeRef = ref(db, `/banners/${id}`);
      await remove(nodeRef);
    } catch (e) {
      console.error('Failed to delete banner', e);
      alert('Failed to delete banner');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Manage Banners</h2>

      <div className="mb-6">
        <h3 className="font-medium mb-2">Create new banner</h3>
        <BannerForm onSubmit={handleCreate} busy={busy} />
      </div>

      <div>
        <h3 className="font-medium mb-2">Existing banners</h3>
        <div className="grid gap-3">
          {list.length === 0 && <div className="text-sm text-gray-500">No banners found</div>}
          {list.map(b => (
            <div key={b.id} className="flex items-center justify-between bg-white p-3 rounded border">
              <div className="flex items-center gap-3">
                <img src={b.image} alt={b.title || 'banner'} className="w-24 h-16 object-cover rounded" />
                <div>
                  <div className="font-medium">{b.title || 'Untitled'}</div>
                  <div className="text-sm text-gray-500">{b.subtitle}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing(b)} className="px-3 py-1 bg-yellow-400 text-white rounded">Edit</button>
                <button onClick={() => handleDelete(b.id)} className="px-3 py-1 bg-red-600 text-white rounded">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white p-4 rounded-lg w-full max-w-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Edit Banner</h3>
              <button onClick={() => setEditing(null)} className="text-sm text-gray-500">Close</button>
            </div>
            <BannerForm initialValues={editing} onSubmit={(vals) => handleUpdate(editing.id, vals)} busy={busy} />
          </div>
        </div>
      )}
    </div>
  );
}
