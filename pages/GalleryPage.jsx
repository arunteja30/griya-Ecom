import React from "react";
import { useFirebaseList } from "../hooks/useFirebase";
import Loader from "../components/Loader";
import SectionTitle from "../components/SectionTitle";
import { normalizeImageUrl } from '../utils/imageHelpers';

export default function GalleryPage() {
  const { data: gallery, loading } = useFirebaseList("/gallery");
  if (loading) return <Loader />;

  const items = gallery ? Object.values(gallery).sort((a,b)=> (a.order||0)-(b.order||0)) : [];

  return (
    <div>
      <SectionTitle title="Gallery" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((it, idx) => (
          <div key={idx} className="overflow-hidden rounded">
            <img src={normalizeImageUrl(it.url) || '/placeholder.jpg'} alt={it.caption} className="w-full h-64 object-cover" />
            <div className="p-2 text-sm text-gray-600">{it.caption}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
