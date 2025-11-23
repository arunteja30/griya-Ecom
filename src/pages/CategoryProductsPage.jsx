import React, { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCategoryBySlug, useFirebaseList } from "../hooks/useFirebase";
import ProductCard from "../components/ProductCard";
import Loader from "../components/Loader";
import SectionTitle from "../components/SectionTitle";
import FilterBar from "../components/FilterBar";

export default function CategoryProductsPage() {
  const { categorySlug } = useParams();
  const { data: category, loading: catLoading } = useCategoryBySlug(categorySlug);
  const { data: productsData, loading: prodLoading } = useFirebaseList("/products");
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [priceRange, setPriceRange] = useState('all');
  const [filterInStock, setFilterInStock] = useState(false);

  const filteredAndSortedProducts = useMemo(() => {
    if (!productsData || !category) return [];
    
    let products = Object.values(productsData).filter((p) => p.categoryId === category.id);
    
    // Filter by search term
    if (searchTerm) {
      products = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // Filter by stock
    if (filterInStock) {
      products = products.filter(p => p.inStock !== false);
    }
    
    // Filter by price range
    if (priceRange !== 'all') {
      products = products.filter(p => {
        const price = p.price || 0;
        switch (priceRange) {
          case 'under50': return price < 50;
          case '50-100': return price >= 50 && price <= 100;
          case '100-200': return price > 100 && price <= 200;
          case 'above200': return price > 200;
          default: return true;
        }
      });
    }
    
    // Sort products
    products.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price-low':
          return (a.price || 0) - (b.price || 0);
        case 'price-high':
          return (b.price || 0) - (a.price || 0);
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'popular':
          return (b.orderCount || 0) - (a.orderCount || 0);
        default:
          return 0;
      }
    });
    
    return products;
  }, [productsData, category, searchTerm, sortBy, priceRange, filterInStock]);

  if (catLoading || prodLoading) return <Loader />;
  if (!category) return <div className="text-center py-12">Category not found</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Category Header */}
      <div className="text-center space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{category.name}</h1>
        {category.description && (
          <p className="text-gray-600 max-w-2xl mx-auto">{category.description}</p>
        )}
        <div className="text-sm text-gray-500">
          {filteredAndSortedProducts.length} products available
        </div>
      </div>

      {/* Search and Filters - Swiggy style */}
      <FilterBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sortBy={sortBy}
        setSortBy={setSortBy}
        priceRange={priceRange}
        setPriceRange={setPriceRange}
        filterInStock={filterInStock}
        setFilterInStock={setFilterInStock}
        resultCount={filteredAndSortedProducts.length}
        searchPlaceholder="Search products..."
        onClearFilters={() => {
          setSearchTerm('');
          setPriceRange('all');
          setFilterInStock(false);
          setSortBy('name');
        }}
      />

      {/* Products Grid - Swiggy style */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredAndSortedProducts.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {/* No results state */}
      {filteredAndSortedProducts.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📦</div>
          <h3 className="text-lg font-medium text-gray-600 mb-2">No products found</h3>
          <p className="text-gray-500">Try adjusting your search or filters</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setPriceRange('all');
              setFilterInStock(false);
              setSortBy('name');
            }}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
}
