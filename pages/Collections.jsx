import React from "react";
import { useCategories } from "../hooks/useRealtime";
import { Link } from "react-router-dom";

export default function Collections() {
  const { data: categories, loading } = useCategories();

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Collections</h1>
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
