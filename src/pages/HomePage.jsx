import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Loader from "../components/Loader";
import SectionTitle from "../components/SectionTitle";
import { normalizeImageUrl } from "../utils/imageHelpers";
import { getCategories } from "../firebaseApi";

export default function HomePage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    <main>
      <section className="py-6 bg-white">
        <div className="section-container">
          {error ? (
            <div className="text-center py-12">
              <div className="text-red-600 font-medium mb-2">Failed to load categories</div>
              <div className="text-sm text-neutral-600">{error}</div>
            </div>
          ) : categories && categories.length ? (
            <>
              <SectionTitle
                title="Collections"
                subtitle={`${categories.length} collections`}
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {categories.map((col) => (
                  <Link
                    key={col.id}
                    to={`/category/${col.id}`}
                    className="block rounded overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white"
                  >
                    <div className="relative h-40 bg-neutral-100">
                      <img
                        src={normalizeImageUrl(col?.image || col?.imageUrl || '/placeholder.jpg')}
                        alt={col?.title || col?.name || col.id}
                        className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/25 flex items-end p-3">
                        <div className="text-white">
                          <div className="font-semibold">
                            {col?.title || col?.name || col.id}
                          </div>
                          {col?.subtitle && <div className="text-xs">{col.subtitle}</div>}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="col-span-full text-center py-12">No collections available</div>
          )}
        </div>
      </section>
    </main>
  );
}
