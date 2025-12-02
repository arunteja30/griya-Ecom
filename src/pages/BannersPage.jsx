import React from 'react';
import Loader from '../components/Loader';
import { normalizeImageUrl } from '../utils/imageHelpers';
import { useFirebaseList } from '../hooks/useFirebase';
import { Link } from 'react-router-dom';
import UniversalImage from '../components/UniversalImage';

export default function BannersPage() {
  const { data: bannersData, loading, error } = useFirebaseList('/banners');

  const items = React.useMemo(() => {
    const out = [];
    if (!bannersData) return out;
    if (Array.isArray(bannersData)) {
      return bannersData.map((b, i) => ({ id: b?.id || `b-${i}`, ...b }));
    }
    Object.entries(bannersData).forEach(([id, b]) => out.push({ id, ...b }));
    return out;
  }, [bannersData]);

  if (loading) return <Loader />;

  if (error) return <div className="p-6">Failed to load banners: {String(error)}</div>;

  if (!items || items.length === 0) return <div className="p-6">No banners configured.</div>;

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Banners</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(b => (
          <div key={b.id} className="bg-white border rounded overflow-hidden shadow-sm">
            <div className="w-full h-44 bg-gray-50 overflow-hidden">
              <UniversalImage
                src={normalizeImageUrl(b.image) || b.image || '/placeholder.jpg'}
                alt={b.heading || b.title || ''}
                className="w-full h-full object-cover"
                fallback={'/placeholder.jpg'}
              />
            </div>
            <div className="p-4">
              {b.heading && <h2 className="text-lg font-medium">{b.heading}</h2>}
              {b.body && <p className="text-sm text-gray-600 mt-2">{b.body}</p>}
              <div className="mt-4 flex items-center gap-2">
                {b.ctaLabel && b.link ? (
                  <a href={b.link} className="px-3 py-2 btn btn-primary rounded text-sm" target="_blank" rel="noreferrer">{b.ctaLabel}</a>
                ) : null}
                <Link to="/admin/home" className="text-sm text-gray-500 underline">Edit in admin</Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
