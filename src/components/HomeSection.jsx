import React from 'react';
import ProductCard from './ProductCard';

export default function HomeSection({ title, subtitle, products = [], limit = 8, layout = 'carousel', seeAllLink }) {
  const list = products.slice(0, limit);

  return (
    <section className="bg-white rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          {subtitle && <div className="text-sm text-gray-500">{subtitle}</div>}
        </div>
        {seeAllLink && (
          <a href={seeAllLink} className="text-sm text-orange-600 hover:underline">See all</a>
        )}
      </div>

      {layout === 'carousel' ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {list.map(p => (
            <div key={p.id} className="w-48 flex-shrink-0">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Mobile: horizontal scroller for grid-like sections */}
          <div className="flex gap-4 overflow-x-auto pb-2 md:hidden">
            {list.map(p => (
              <div key={p.id} className="w-48 flex-shrink-0">
                <ProductCard product={p} />
              </div>
            ))}
          </div>

          {/* Desktop: grid layout */}
          <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {list.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
