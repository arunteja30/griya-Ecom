import React from "react";
import { useBanners, useSiteContent, useProducts } from "../hooks/useRealtime";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";

export default function Home() {
  const { data: banners, loading: bannersLoading } = useBanners();
  const { data: siteContent } = useSiteContent();
  const { data: products, loading: productsLoading } = useProducts();

  // normalize products into an array and ensure slug/id present for ProductCard
  const productsArray = products && typeof products === 'object'
    ? Object.entries(products).map(([id, p]) => ({ id, slug: p.slug || p.id || id, ...p }))
    : [];

  return (
    <div>
      <section className="mb-8">
        {bannersLoading ? (
          <div>Loading banners...</div>
        ) : banners ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(banners).map(([key, banner]) => (
              <div key={key} className="relative h-64 bg-gray-100 rounded overflow-hidden">
                <img src={banner.image || '/placeholder.jpg'} alt={banner.title || 'Banner'} className="w-full h-full object-cover" />
                <div className="absolute left-6 bottom-6 text-white">
                  <h2 className="text-2xl font-bold">{banner.title}</h2>
                  <p className="mt-2">{banner.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>No banners configured</div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Featured Products</h2>
        {productsLoading ? (
          <div>Loading products...</div>
        ) : productsArray && productsArray.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {productsArray.slice(0, 12).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div>No products found</div>
        )}
      </section>

      {/* Festive picks: render sections for configured festival tag groups */}
      {siteContent && siteContent.festivals && Object.keys(siteContent.festivals).length > 0 && (
        <section className="mb-8">
          {Object.entries(siteContent.festivals).map(([sectionKey, raw]) => {
            const tags = Array.isArray(raw) ? raw : String(raw || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            const matched = productsArray.filter(p => {
              if (!p.tags) return false;
              const ptags = Array.isArray(p.tags) ? p.tags : String(p.tags).split(',').map(s => s.trim().toLowerCase());
              return ptags.some(t => tags.includes(t));
            }).slice(0, 8);

            if (matched.length === 0) return null;
            const title = (sectionKey || '').replace(/[-_]/g, ' ');
            return (
              <div key={sectionKey} className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-semibold">{title.charAt(0).toUpperCase() + title.slice(1)}</h3>
                  <Link to={`/collections/${sectionKey}`} className="text-sm text-primary-600 hover:underline">See all</Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {matched.map(p => <ProductCard key={p.id} product={p} />)}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section>
        <h2 className="text-2xl font-semibold mb-4">About</h2>
        <div className="prose max-w-none">
          {siteContent?.about || 'About text not configured in database.'}
        </div>
      </section>
    </div>
  );
}
