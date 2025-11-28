import React from "react";
import { useCategories } from "../hooks/useRealtime";
import { Link } from "react-router-dom";

export default function Collections() {
  const { data: categories, loading } = useCategories();

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="p-2 rounded bg-white shadow text-neutral-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-3xl font-bold">Collections</h1>
      </div>
      {loading ? (
        <div>Loading collections...</div>
      ) : categories ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(categories).map(([id, cat]) => (
            <Link to={`/collections/${id}`} key={id} className="block border rounded overflow-hidden">
              <img src={cat.image || '/placeholder.jpg'} alt={cat.title} className="w-full h-40 object-cover" />
              <div className="p-2">
                <div className="font-medium">{cat.title}</div>
                <div className="text-sm text-gray-600">{cat.subtitle}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div>No collections found</div>
      )}
    </div>
  );
}
