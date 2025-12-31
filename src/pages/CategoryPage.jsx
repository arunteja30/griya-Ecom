import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useFirebaseList } from '../hooks/useFirebase';

export default function CategoryPage() {
  const { categoryId } = useParams();
  const location = useLocation();
  const { data: products, loading: productsLoading } = useFirebaseList('/products');
  const { data: categories, loading: categoriesLoading } = useFirebaseList('/categories');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const productsArray = products ? Object.entries(products).map(([id, prod]) => ({ id, ...prod })) : [];
  const categoriesArray = categories ? Object.entries(categories).map(([id, cat]) => ({ id, ...cat })) : [];
  
  // Find current category by id
  const currentCategory = categoriesArray.find(cat => cat.id === categoryId);
  const categoryName = currentCategory?.name || categoryId;

  // Debug logging
  console.log('CategoryPage Debug:', {
    categoryId,
    currentCategory,
    categoryName,
    categoriesCount: categoriesArray.length,
    productsCount: productsArray.length
  });

  // Get search term from URL params if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get('q');
    if (query) {
      setSearchTerm(query);
    }
  }, [location.search]);

  // Filter products based on search and category
  const filteredProducts = productsArray.filter(product => {
    const matchesSearch = !searchTerm || 
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // More flexible category matching
    const matchesCategory = 
      product.category === categoryName || 
      product.categoryId === categoryId ||
      product.category === categoryId ||
      product.categoryId === currentCategory?.name ||
      product.category === currentCategory?.name ||
      (product.tags && Array.isArray(product.tags) && product.tags.includes(categoryId)) ||
      (product.tags && typeof product.tags === 'string' && product.tags.toLowerCase().includes(categoryId.toLowerCase()));
    
    return matchesSearch && matchesCategory;
  });

  // Debug filtered products
  console.log('CategoryPage Filtered:', {
    searchTerm,
    filteredCount: filteredProducts.length,
    sampleProducts: filteredProducts.slice(0, 3).map(p => ({ id: p.id, name: p.name, category: p.category, categoryId: p.categoryId }))
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price-low':
        return (a.price || 0) - (b.price || 0);
      case 'price-high':
        return (b.price || 0) - (a.price || 0);
      case 'name':
      default:
        return (a.name || '').localeCompare(b.name || '');
    }
  });

  const handleSearch = (e) => {
    e.preventDefault();
    // Search logic is handled by state change
  };

  if (productsLoading || categoriesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-surface-600">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-safe">
      {/* Search Header */}
      <div className="bg-gradient-to-br from-primary-500 to-fresh-500 text-white px-mobile py-6">
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">{categoryName} Products</h1>
          
          {/* Search Form */}
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder={`Search in ${categoryName}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border-0 bg-white/20 backdrop-blur-sm text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>
          </form>
        </div>
      </div>

      {/* Filters */}
      <div className="px-mobile py-4 border-b border-surface-200">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide">
          {/* Sort Filter */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="flex-shrink-0 px-3 py-2 rounded-lg border border-surface-300 bg-white text-sm"
          >
            <option value="name">Sort by Name</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="px-mobile py-4">
        {/* Results Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-surface-900">
            {searchTerm ? `Results for "${searchTerm}" in ${categoryName}` : `${categoryName} Products`}
          </h2>
          <span className="text-sm text-surface-500">
            {sortedProducts.length} result{sortedProducts.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Products Grid */}
        {sortedProducts.length > 0 ? (
          <div className="product-grid">
            {sortedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-surface-900 mb-2">No products found</h3>
            <p className="text-surface-500 mb-6">
              {searchTerm 
                ? `No products match "${searchTerm}" in ${categoryName}. Try a different keyword.`
                : `No products available in ${categoryName} category.`
              }
            </p>
            <button 
              onClick={() => setSearchTerm('')}
              className="btn-primary"
            >
              Clear Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}