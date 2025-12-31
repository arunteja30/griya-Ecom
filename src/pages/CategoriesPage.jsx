import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFirebaseList } from '../hooks/useFirebase';

export default function CategoriesPage() {
  const { data: categories, loading, error } = useFirebaseList('/categories');
  const [searchTerm, setSearchTerm] = useState('');

  const categoriesArray = categories ? Object.entries(categories).map(([id, cat]) => ({ id, ...cat })) : [];

  // Filter categories based on search
  const filteredCategories = categoriesArray.filter(category => 
    !searchTerm || category.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-surface-600">Loading categories...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen px-mobile py-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center backdrop-blur-sm">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-red-700 font-medium mb-2">Failed to load categories</p>
          <p className="text-red-600 text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-safe">
      {/* Hero Header */}
      <section className="relative bg-gradient-to-br from-primary-500 via-primary-600 to-fresh-500 text-white overflow-hidden">
        <div className="px-mobile py-16 relative">
          {/* Floating Elements */}
          <div className="absolute top-8 right-8 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
          <div className="absolute bottom-12 left-8 w-16 h-16 bg-accent-gold/20 rounded-full blur-lg"></div>
          
          <div className="text-center space-y-6 relative">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">
                Shop by 
                <br />
                <span className="text-accent-gold">Categories</span>
              </h1>
              <p className="text-lg text-white/90">
                Browse all product categories
              </p>
            </div>

            {/* Search Bar */}
            <div className="max-w-md mx-auto relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-6 w-6 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-bar text-surface-900 shadow-float w-full"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                >
                  <svg className="h-5 w-5 text-surface-400 hover:text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Quick Stats */}
            <div className="flex justify-center gap-8 pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{categoriesArray.length}+</div>
                <div className="text-sm opacity-80">Categories</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">1000+</div>
                <div className="text-sm opacity-80">Products</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">24/7</div>
                <div className="text-sm opacity-80">Available</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Wave Separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" className="w-full h-8 fill-surface-50">
            <path d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,64C960,75,1056,85,1152,80C1248,75,1344,53,1392,42.7L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"></path>
          </svg>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-6 px-mobile">
        <div className="space-y-6">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-surface-900">
                {searchTerm ? `Search Results` : 'All Categories'}
              </h2>
              <p className="text-surface-500 text-sm mt-1">
                {filteredCategories.length} categor{filteredCategories.length !== 1 ? 'ies' : 'y'} available
              </p>
            </div>
          </div>

          {/* Categories Grid */}
          {filteredCategories.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {filteredCategories.map((category) => (
                <Link
                  key={category.id}
                  to={`/category/${category.id}`}
                  className="group relative card-glass p-3 rounded-xl hover:scale-[1.02] transition-all duration-300 shadow-xl hover:shadow-2xl border border-white/20 hover:border-primary-300/50"
                >
                  {/* Enhanced Background Glow */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary-500/20 to-fresh-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                  
                  <div className="relative space-y-3">
                    {/* Category Image/Icon */}
                    <div className="w-16 h-24 mx-auto rounded-lg bg-gradient-to-br from-primary-100 via-primary-50 to-fresh-100 flex items-center justify-center overflow-hidden relative shadow-md group-hover:shadow-lg transition-shadow">
                      {/* Enhanced Glow effect */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 to-fresh-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      
                      {category.imageUrl || category.image ? (
                        <img 
                          src={category.imageUrl || category.image} 
                          alt={category.name}
                          className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="w-10 h-10 bg-gradient-to-br from-primary-400 to-fresh-500 rounded-lg flex items-center justify-center shadow-lg relative z-10 group-hover:shadow-xl group-hover:scale-110 transition-all duration-300" 
                        style={{display: category.imageUrl || category.image ? 'none' : 'flex'}}
                      >
                        <span className="text-white font-bold text-sm">
                          {category.name?.charAt(0)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Category Info */}
                    <div className="space-y-1.5">
                      <h3 className="font-bold text-surface-900 text-base group-hover:text-primary-600 transition-colors line-clamp-1 drop-shadow-sm">
                        {category.name}
                      </h3>
                      {category.description && (
                        <p className="text-surface-500 text-xs line-clamp-1 group-hover:text-surface-600 transition-colors">
                          {category.description}
                        </p>
                      )}
                      
                      {/* Enhanced Arrow indicator */}
                      <div className="flex items-center text-primary-500 text-xs font-medium group-hover:text-primary-600 transition-colors">
                        <span className="drop-shadow-sm">Explore</span>
                        <svg className="w-3 h-3 ml-1 group-hover:translate-x-1 group-hover:scale-110 transition-all duration-300 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="relative">
                {/* Floating elements */}
                <div className="absolute top-4 left-1/2 w-12 h-12 bg-primary-200/30 rounded-full blur-sm transform -translate-x-8"></div>
                <div className="absolute top-8 right-1/2 w-8 h-8 bg-fresh-300/40 rounded-full blur-sm transform translate-x-12"></div>
                
                <div className="text-8xl mb-6">🔍</div>
                <h3 className="text-2xl font-bold text-surface-900 mb-3">
                  {searchTerm ? 'No categories found' : 'No categories available'}
                </h3>
                <p className="text-surface-600 mb-8 max-w-md mx-auto">
                  {searchTerm 
                    ? `No categories match "${searchTerm}". Try a different search term.`
                    : 'Categories will appear here when available'
                  }
                </p>
                
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="btn-primary"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}