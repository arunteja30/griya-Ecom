import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProductsByCategory, getCategories } from '../firebaseApi';
import ProductCard from '../components/ProductCard';
import Loader from '../components/Loader';
import SectionTitle from '../components/SectionTitle';

export default function CategoryPage() {
  const { categoryId } = useParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categoryName, setCategoryName] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      getProductsByCategory(categoryId),
      getCategories()
    ])
      .then(([prods, cats]) => {
        if (!mounted) return;
        setProducts(prods || []);
        const found = (cats || []).find((c) => String(c.id) === String(categoryId) || c.slug === categoryId);
        setCategoryName(found ? (found.title || found.name || found.id) : `Category: ${categoryId}`);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('Failed to load products for category', err);
        setError(err.message || 'Failed to load products');
        setLoading(false);
      });

    return () => { mounted = false; };
  }, [categoryId]);

  if (loading) return <Loader />;

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">{categoryName || `Category: ${categoryId}`}</h1>
        <div className="flex items-center gap-2">
          <Link to="/" className="btn btn-ghost">Back to Home</Link>
          <Link to="/groceries" className="btn btn-ghost">Browse Groceries</Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border p-6 bg-white text-center">
          <div className="text-red-600 font-medium mb-2">Failed to load products</div>
          <div className="text-sm text-neutral-600">{error}</div>
        </div>
      ) : products && products.length ? (
        <div>
          <SectionTitle title={categoryName || 'Products'} subtitle={`${products.length} items`} />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">No products found</h2>
          <p className="text-neutral-600 mb-4">There are no products in this category yet.</p>
          <div className="flex justify-center gap-3">
            <Link to="/" className="btn btn-primary">Back to Home</Link>
            <Link to="/groceries" className="btn btn-ghost">Browse other groceries</Link>
          </div>
        </div>
      )}
    </div>
  );
}
