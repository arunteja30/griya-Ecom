import React, { useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useFirebaseList } from '../hooks/useFirebase';
import ProductCard from '../components/ProductCard';
import Loader from '../components/Loader';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function SearchPage() {
  const q = useQuery().get('q') || '';
  const { data: productsData, loading } = useFirebaseList('/products');

  const products = productsData && typeof productsData === 'object' ? Object.values(productsData) : [];

  const results = useMemo(() => {
    const term = (q || '').trim().toLowerCase();
    if (!term) return [];
    return products.filter(p => {
      const name = (p.name || '').toLowerCase();
      const desc = (p.description || '') + ' ' + (p.longDescription || '');
      const tags = (p.tags || []).join(' ').toLowerCase();
      const categories = (p.category || p.categoryId || '').toString().toLowerCase();
      return name.includes(term) || desc.toLowerCase().includes(term) || tags.includes(term) || categories.includes(term) || (p.sku||'').toLowerCase().includes(term);
    });
  }, [products, q]);

  if (loading) return <Loader />;

  return (
    <div className="py-6 mt-6">
      <h2 className="text-xl font-semibold mb-4">Search results for "{q}"</h2>
      {results.length === 0 ? (
        <div className="text-neutral-600">No results found.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {results.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
