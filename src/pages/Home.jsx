import React from "react";
import { useBanners, useSiteContent, useProducts } from "../hooks/useRealtime";
import { Link } from "react-router-dom";

export default function Home() {
  const { data: banners, loading: bannersLoading } = useBanners();
  const { data: siteContent } = useSiteContent();
  const { data: products, loading: productsLoading } = useProducts();

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
        ) : products ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(products).map(([id, p]) => (
              <Link to={`/products/${id}`} key={id} className="block border rounded p-2">
                <img src={p.image || '/placeholder.jpg'} alt={p.title} className="w-full h-40 object-cover mb-2 rounded" />
                <div className="text-sm font-medium">{p.title}</div>
                <div className="text-sm text-gray-600">₹{p.price}</div>
              </Link>
            ))}
          </div>
        ) : (
          <div>No products found</div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">About</h2>
        <div className="prose max-w-none">
          {siteContent?.about || 'About text not configured in database.'}
        </div>
      </section>
    </div>
  );
}
