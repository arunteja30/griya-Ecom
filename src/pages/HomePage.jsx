import React from "react";
import { useFirebaseObject, useFirebaseList } from "../hooks/useFirebase";
import SectionTitle from "../components/SectionTitle";
import ProductCard from "../components/ProductCard";
import Loader from "../components/Loader";

export default function HomePage() {
  const { data: home, loading: homeLoading } = useFirebaseObject("/home");
  const { data: productsDataObj, loading: productsLoading } = useFirebaseList("/products");
  const products = productsDataObj ? productsDataObj : null;
  const { data: testimonials, loading: testimonialsLoading } = useFirebaseList("/testimonials");

  if (homeLoading || productsLoading) return <Loader />;

  const newArrivalsIds = home?.sections?.newArrivals?.productIds || [];
  const bestSellersIds = home?.sections?.bestSellers?.productIds || [];

  const findProducts = (ids) => ids.map((id) => products?.[id]).filter(Boolean);

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="rounded overflow-hidden shadow-sm">
        <div className="relative h-96">
          <img src={home?.hero?.image || '/placeholder.jpg'} alt={home?.hero?.title} className="w-full h-full object-cover" />
          <div className="absolute left-8 top-24 text-white max-w-lg">
            <h1 className="text-4xl font-bold">{home?.hero?.title}</h1>
            <p className="mt-2 text-lg">{home?.hero?.subtitle}</p>
            {home?.hero?.buttonUrl && (
              <a href={home.hero.buttonUrl} className="mt-4 inline-block bg-black text-white px-4 py-2 rounded">{home.hero.buttonText || 'Shop'}</a>
            )}
          </div>
        </div>
      </section>

      {/* New Arrivals */}
      <section>
        <SectionTitle title={home?.sections?.newArrivals?.title || 'New Arrivals'} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {findProducts(newArrivalsIds).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Best Sellers */}
      <section>
        <SectionTitle title={home?.sections?.bestSellers?.title || 'Featured'} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {findProducts(bestSellersIds).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section>
        <SectionTitle title="Testimonials" />
        {testimonialsLoading ? (
          <Loader />
        ) : testimonials ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(testimonials).map(([id, t]) => (
              <div key={id} className="border p-4 rounded bg-white flex gap-3 items-start">
                {t.photo && (
                  <img src={t.photo} alt={t.name} className="w-16 h-16 object-cover rounded-full" />
                )}
                <div className="flex-1">
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-gray-600 text-sm mt-1">{t.message ?? t.review}</div>
                  <div className="mt-2 text-sm text-gray-500 flex items-center gap-3">
                    {typeof t.rating !== 'undefined' && (
                      <div className="text-yellow-500">{ '★'.repeat(Math.round(Math.max(0, Math.min(5, t.rating || 0)))) }</div>
                    )}
                    {t.date && <div className="text-xs">{t.date}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>No testimonials</div>
        )}
      </section>
    </div>
  );
}
