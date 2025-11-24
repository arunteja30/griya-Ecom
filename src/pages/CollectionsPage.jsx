import React, { useState, useMemo } from "react";
import { useFirebaseList } from "../hooks/useFirebase";
import SectionTitle from "../components/SectionTitle";
import Loader from "../components/Loader";
import { Link } from "react-router-dom";
import FilterBar from "../components/FilterBar";

export default function CollectionsPage() {
  const { data: categories, loading } = useFirebaseList("/categories");
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const filteredAndSortedCategories = useMemo(() => {
    if (!categories) return [];
    
    let cats = Object.values(categories);
    
    // Filter by search term
    if (searchTerm) {
      cats = cats.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // Sort categories
    cats.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'popular':
          return (b.productCount || 0) - (a.productCount || 0);
        default:
          return (a.sortOrder || 0) - (b.sortOrder || 0);
      }
    });
    
    return cats;
  }, [categories, searchTerm, sortBy]);

  if (loading) return <Loader />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          Shop by Category
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Browse our wide selection of fresh groceries and daily essentials
        </p>
      </div>
      
      {/* Search and Filter Bar - Swiggy style */}
      <FilterBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sortBy={sortBy}
        setSortBy={setSortBy}
        priceRange="" // Not used for categories
        setPriceRange={() => {}} // Not used for categories
        filterInStock={false} // Not used for categories
        setFilterInStock={() => {}} // Not used for categories
        resultCount={filteredAndSortedCategories.length}
        searchPlaceholder="Search categories..."
        showPriceFilter={false}
        showStockFilter={false}
        onClearFilters={() => {
          setSearchTerm('');
          setSortBy('name');
        }}
      />

      {/* Categories Grid - Swiggy style cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9 gap-4">
        {filteredAndSortedCategories.map((c) => (
          <Link
            key={c.id}
            to={`/category/${c.slug || c.id}`}
            className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100"
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-orange-50 to-orange-100 aspect-square">
              <img 
                src={c.thumbnail || c.image || '/placeholder.jpg'} 
                alt={c.name} 
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
              
              {/* Product count badge */}
              {c.productCount && (
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-medium px-2 py-1 rounded-full">
                  {c.productCount} items
                </div>
              )}
            </div>
            
            <div className="p-4">
              <div className="font-semibold text-gray-800 text-lg group-hover:text-orange-600 transition-colors duration-200">
                {c.name}
              </div>
              {c.description && (
                <div className="text-sm text-gray-500 mt-1 line-clamp-2">
                  {c.description}
                </div>
              )}
              
              {/* Quick stats */}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400">Browse now</span>
                <svg className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* No results state */}
      {filteredAndSortedCategories.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-600 mb-2">No categories found</h3>
          <p className="text-gray-500">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
}
