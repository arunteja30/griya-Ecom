import React, { useState } from "react";
import { useFirebaseList } from "../hooks/useFirebase";
import SectionTitle from "../components/SectionTitle";
import Loader from "../components/Loader";
import { Link } from "react-router-dom";

export default function CollectionsPage() {
  const { data: categories, loading } = useFirebaseList("/categories");
  const [searchTerm, setSearchTerm] = useState("");

  if (loading) return <Loader />;

  const cats = categories ? Object.values(categories).sort((a,b)=> (a.sortOrder||0)-(b.sortOrder||0)) : [];
  
  // Filter categories by search
  const filtered = cats.filter(c => 
    !searchTerm || c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <SectionTitle title="Groceries" subtitle="Browse by category" />
      
      {/* Search Filter */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search categories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-96 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Swiggy-style category cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((c) => (
          <Link
            key={c.id}
            to={`/groceries/${c.slug || c.id}`}
            className="group bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-200 border border-neutral-100"
          >
            <div className="aspect-square bg-neutral-50 overflow-hidden">
              <img 
                src={c.image || c.thumbnail || '/placeholder.jpg'} 
                alt={c.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
              />
            </div>
            <div className="p-3">
              <div className="font-semibold text-base text-neutral-900 line-clamp-1">{c.name}</div>
              {c.description && <div className="text-xs text-neutral-500 mt-1 line-clamp-2">{c.description}</div>}
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-neutral-500">
          No categories found matching "{searchTerm}"
        </div>
      )}
    </div>
  );
}
