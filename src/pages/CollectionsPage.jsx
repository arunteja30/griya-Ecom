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
          <Link key={c.id} to={`/collections/${c.slug}`} className="block border rounded overflow-hidden bg-white">
            <img src={c.thumbnail || '/placeholder.jpg'} alt={c.name} className="w-full h-56 object-cover" />
            <div className="p-4">
              <div className="font-semibold">{c.name}</div>
              <div className="text-sm text-gray-600">{c.description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
