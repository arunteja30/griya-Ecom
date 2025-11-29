import React from 'react';
import ProductCard from './ProductCard';

export default function HomeSection({ title, subtitle, products = [], limit = 8, layout = 'carousel', seeAllLink }) {
  const list = products.slice(0, limit);

  return (
    <section className="rounded-lg mt-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          {subtitle && <div className="text-sm text-gray-500">{subtitle}</div>}
        </div>
        {seeAllLink && (
          <a href={seeAllLink} className="text-sm text-orange-600 hover:underline">See all</a>
        )}
      </div>

      {/* Always horizontal scrolling list on home screen (compact on mobile) */}
      <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
        {list.map(p => (
          <div key={p.id} className="w-36 sm:w-44 md:w-48 lg:w-56 flex-shrink-0">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
