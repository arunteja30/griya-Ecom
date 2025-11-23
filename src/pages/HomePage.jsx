import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Loader from "../components/Loader";
import { normalizeImageUrl } from "../utils/imageHelpers";
import { useFirebaseList } from "../hooks/useFirebase";
import { getCategories } from "../firebaseApi";

import RecommendationsSection from "../components/RecommendationsSection";

export default function HomePage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { data: productsData } = useFirebaseList("/products");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getCategories()
      .then((data) => {
        if (!mounted) return;
        setCategories(data || []);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('Failed to load categories', err);
        setError(err.message || 'Failed to load categories');
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);



  if (loading) return <Loader />;

  return (
    <main className="space-y-8 pb-8">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800">
              Fresh Groceries Delivered Fast
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Order fresh groceries and daily essentials with quick delivery
            </p>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="max-w-7xl mx-auto px-4">
        {error ? (
          <div className="text-center py-12">
            <div className="text-red-600 font-medium mb-2">Failed to load categories</div>
            <div className="text-sm text-gray-600">{error}</div>
          </div>
        ) : categories && categories.length ? (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">Shop by Category</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {categories.map((col) => (
                <Link
                  key={col.id}
                  to={`/groceries/${col.slug || col.id}`}
                  className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100"
                >
                  <div className="relative aspect-square bg-gradient-to-br from-orange-50 to-orange-100">
                    <img
                      src={normalizeImageUrl(col?.image || col?.imageUrl || '/placeholder.jpg')}
                      alt={col?.title || col?.name || col.id}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                  </div>
                  <div className="p-3 text-center">
                    <div className="font-medium text-gray-800 text-sm group-hover:text-orange-600 transition-colors">
                      {col?.title || col?.name || col.id}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🛒</div>
            <p className="text-gray-600">No categories available</p>
          </div>
        )}
      </section>

      {/* Recommended Products Section */}
      <section className="max-w-7xl mx-auto px-4">
        <RecommendationsSection 
          title="Recommended for You"
          limit={8}
        />
      </section>

  
    </main>
  );
}
