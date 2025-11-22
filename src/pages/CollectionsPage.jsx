import React from "react";
import { useFirebaseList } from "../hooks/useFirebase";
import SectionTitle from "../components/SectionTitle";
import Loader from "../components/Loader";
import { Link } from "react-router-dom";

export default function CollectionsPage() {
  const { data: categories, loading } = useFirebaseList("/categories");

  if (loading) return <Loader />;

  const cats = categories ? Object.values(categories).sort((a,b)=> (a.sortOrder||0)-(b.sortOrder||0)) : [];

  return (
    <div>
      <SectionTitle title="Collections" subtitle="Browse by category" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cats.map((c) => (
          <Link
            key={c.id}
            to={`/collections/${c.slug}`}
            className="card overflow-hidden hover:shadow-lg transition-shadow duration-300"
          >
            <div className="w-full h-56 bg-neutral-100 overflow-hidden">
              <img src={c.thumbnail || '/placeholder.jpg'} alt={c.name} className="w-full h-full object-cover" />
            </div>
            <div className="p-6">
              <div className="font-semibold text-lg text-primary-900">{c.name}</div>
              {c.description && <div className="text-sm text-neutral-500 mt-2">{c.description}</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
