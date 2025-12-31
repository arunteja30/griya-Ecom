import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useFirebaseList } from '../hooks/useFirebase';

export default function HomePage() {
  const { data: categories, loading: categoriesLoading, error: categoriesError } = useFirebaseList('/categories');
  const { data: products, loading: productsLoading, error: productsError } = useFirebaseList('/products');
  const { data: homeConfig, loading: homeConfigLoading } = useFirebaseList('/homeConfig');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categoriesArray = categories ? Object.entries(categories).map(([id, cat]) => ({ id, ...cat })) : [];
  const productsArray = products ? Object.entries(products).map(([id, prod]) => ({ id, ...prod })) : [];

  // Debug logging
  console.log('Categories:', { data: categories, loading: categoriesLoading, error: categoriesError });
  console.log('Products:', { data: products, loading: productsLoading, error: productsError });
  console.log('HomeConfig:', { data: homeConfig, loading: homeConfigLoading });

  // Filter products based on search and category
  const filteredProducts = productsArray.filter(product => {
    const matchesSearch = !searchTerm || product.name?.toLowerCase().includes(searchTerm.toLowerCase()) || product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory || product.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Helper function to get products by tags
  const getProductsByTags = (tags, limit = 8) => {
    if (!tags || !Array.isArray(tags)) return [];
    return productsArray.filter(product => {
      if (!product.tags) return false;
      const productTags = Array.isArray(product.tags) 
        ? product.tags 
        : String(product.tags).split(',').map(s => s.trim().toLowerCase());
      return tags.some(tag => productTags.includes(String(tag).toLowerCase()));
    }).slice(0, limit);
  };

  // Dynamic sections from homeConfig
  const showConfig = homeConfig?.show || {};
  
  // Get products for different sections
  const featuredProducts = homeConfig?.featured ? getProductsByTags(homeConfig.featured) : productsArray.filter(p => p.featured).slice(0, 6);
  const popularProducts = homeConfig?.popular ? getProductsByTags(homeConfig.popular) : productsArray.filter(p => p.popular || p.orderCount > 10).slice(0, 8);
  const dealsProducts = homeConfig?.deals ? getProductsByTags(homeConfig.deals) : productsArray.filter(p => p.discount && p.discount > 0).slice(0, 8);
  const quickBuyProducts = homeConfig?.quickBuys ? getProductsByTags(homeConfig.quickBuys) : productsArray.filter(p => p.inStock !== false).slice(0, 8);
  const recommendedProducts = homeConfig?.recommended ? getProductsByTags(homeConfig.recommended) : productsArray.slice(0, 8);
  
  // Festival sections
  const festivalSections = React.useMemo(() => {
    if (!homeConfig?.festivals) return [];
    const sections = [];
    Object.entries(homeConfig.festivals).forEach(([festKey, tags]) => {
      if (!tags || !Array.isArray(tags)) return;
      const products = getProductsByTags(tags, 8);
      if (products.length > 0) {
        sections.push({
          key: festKey,
          title: `${festKey.charAt(0).toUpperCase()}${festKey.slice(1)} Specials`,
          products
        });
      }
    });
    return sections;
  }, [homeConfig, productsArray]);

  return (
    <div className="min-h-screen">
      {/* Loading State */}
      {(categoriesLoading || productsLoading || homeConfigLoading) && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-surface-600">Loading fresh groceries...</p>
          </div>
        </div>
      )}
      
      {/* Error State */}
      {(categoriesError || productsError) && (
        <div className="px-mobile py-6">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <p className="text-red-700 font-medium">Failed to load data</p>
            <p className="text-red-600 text-sm mt-1">
              {categoriesError?.message || productsError?.message || 'Please check your internet connection'}
            </p>
          </div>
        </div>
      )}
      {/* Hero Section with Search */}
      <section className="bg-gradient-to-br from-primary-500 via-primary-600 to-fresh-500 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/pattern.svg')] opacity-10"></div>
        <div className="px-mobile py-8 relative">
          <div className="space-y-6">
            {/* Hero Text */}
            <div className="text-center space-y-3">
              <h1 className="text-3xl sm:text-4xl font-bold">
                Fresh Groceries
                <br />
                <span className="text-accent-gold">Delivered Fast</span>
              </h1>
              <p className="text-lg text-white/90">
                Get fresh groceries delivered to your door in 30 minutes
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
                placeholder="Search for groceries..."
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
                <div className="text-2xl font-bold">30min</div>
                <div className="text-sm opacity-80">Delivery</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">1000+</div>
                <div className="text-sm opacity-80">Products</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">24/7</div>
                <div className="text-sm opacity-80">Support</div>
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

      {/* Categories Stories - Hidden when searching */}
      {!searchTerm && (
        <section className="py-6 px-mobile">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-surface-900">Shop by Category</h2>
            <div className="grid grid-cols-4 gap-3">
              <Link
                to="/groceries"
                className="group flex flex-col items-center space-y-2"
              >
                <div className="relative w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl group-hover:scale-105 transition-all duration-300 border border-white/30 hover:border-primary-300/50">
                  {/* Glow effect */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary-400/30 to-primary-500/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                  <svg className="w-8 h-8 text-primary-500 relative z-10 group-hover:scale-110 transition-transform duration-300 drop-shadow-sm" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                  </svg>
                </div>
                <span className="text-xs font-medium text-surface-900 text-center group-hover:text-primary-600 transition-colors drop-shadow-sm">All</span>
              </Link>

              {categoriesArray.map((category) => (
                <Link
                  key={category.id}
                  to={`/category/${category.id}`}
                  className="group flex flex-col items-center space-y-2"
                >
                  <div className="relative w-16 h-16 bg-gradient-to-br from-primary-100 to-fresh-100 rounded-2xl flex items-center justify-center overflow-hidden shadow-lg hover:shadow-xl group-hover:scale-105 transition-all duration-300 border border-white/30 hover:border-fresh-300/50">
                    {/* Enhanced Glow effect */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary-400/30 to-fresh-400/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                    {category.imageUrl || category.image ? (
                      <img 
                        src={category.imageUrl || category.image} 
                        alt={category.name}
                        className="w-full h-full object-cover rounded-2xl group-hover:scale-110 transition-transform duration-300"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className="w-8 h-8 bg-gradient-to-br from-fresh-400 to-fresh-500 rounded-lg flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-300 relative z-10" style={{display: category.imageUrl || category.image ? 'none' : 'flex'}}>
                      <span className="text-white font-bold text-sm drop-shadow-sm">
                        {category.name?.charAt(0)}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-surface-900 text-center line-clamp-2 group-hover:text-primary-600 transition-colors drop-shadow-sm">
                    {category.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Products - Hidden when searching */}
      {!searchTerm && showConfig.featured !== false && featuredProducts.length > 0 && (
        <section className="py-6 px-mobile">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-surface-900">✨ Featured</h2>
              <Link to="/collections" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                See all
              </Link>
            </div>
            <div className="story-scroll">
              {featuredProducts.map((product) => (
                <div key={`featured-${product.id}`} className="w-32 flex-shrink-0">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Festival Sections - Hidden when searching */}
      {!searchTerm && festivalSections.map((section) => (
        <section key={section.key} className="py-6 px-mobile">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-surface-900">{section.title}</h2>
              <Link to={`/collections`} className="text-sm font-medium text-primary-600 hover:text-primary-700">
                See all
              </Link>
            </div>
            <div className="story-scroll">
              {section.products.map((product) => (
                <div key={`${section.key}-${product.id}`} className="w-32 flex-shrink-0">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Popular Products - Hidden when searching */}
      {!searchTerm && showConfig.popular !== false && popularProducts.length > 0 && (
        <section className="py-6 px-mobile">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-surface-900">🔥 Popular</h2>
              <Link to="/collections" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                See all
              </Link>
            </div>
            <div className="story-scroll">
              {popularProducts.map((product) => (
                <div key={`popular-${product.id}`} className="w-32 flex-shrink-0">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Deals & Offers - Hidden when searching */}
      {!searchTerm && showConfig.deals !== false && dealsProducts.length > 0 && (
        <section className="py-6 px-mobile">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-surface-900">💰 Best Deals</h2>
              <Link to="/collections" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                See all
              </Link>
            </div>
            <div className="story-scroll">
              {dealsProducts.map((product) => (
                <div key={`deals-${product.id}`} className="w-32 flex-shrink-0">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Quick Buys - Hidden when searching */}
      {!searchTerm && showConfig.quickBuys !== false && quickBuyProducts.length > 0 && (
        <section className="py-6 px-mobile">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-surface-900">⚡ Quick Buys</h2>
              <Link to="/collections" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                See all
              </Link>
            </div>
            <div className="story-scroll">
              {quickBuyProducts.map((product) => (
                <div key={`quickbuy-${product.id}`} className="w-32 flex-shrink-0">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recommended for You - Hidden when searching */}
      {!searchTerm && showConfig.recommended !== false && recommendedProducts.length > 0 && (
        <section className="py-6 px-mobile">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-surface-900">👍 Recommended</h2>
              <Link to="/collections" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                See all
              </Link>
            </div>
            <div className="story-scroll">
              {recommendedProducts.map((product) => (
                <div key={`recommended-${product.id}`} className="w-32 flex-shrink-0">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Promotional Banner - Hidden when searching */}
      {!searchTerm && (
        <section className="py-6 px-mobile">
          <div className="card-glass bg-gradient-to-r from-accent-coral/20 to-accent-gold/20 p-6 rounded-3xl border border-accent-coral/20">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-surface-900">Free Delivery</h3>
                <p className="text-surface-600">On orders above ₹199</p>
                <button className="btn-fresh text-sm px-6 py-2">
                  Shop Now
                </button>
              </div>
              <div className="text-6xl opacity-50">🚚</div>
            </div>
          </div>
        </section>
      )}

      {/* Search Results / All Products Grid */}
      <section className="py-6 px-mobile pb-safe">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-surface-900">
              {searchTerm 
                ? `Search results for "${searchTerm}"` 
                : selectedCategory === 'all' 
                  ? 'All Products' 
                  : `${selectedCategory} Products`
              }
            </h2>
            {searchTerm ? (
              <span className="text-sm text-surface-500">
                {filteredProducts.length} item{filteredProducts.length !== 1 ? 's' : ''}
              </span>
            ) : (
              <Link to="/groceries" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                See all
              </Link>
            )}
          </div>

          {filteredProducts.length > 0 ? (
            <div className="story-scroll">
              {filteredProducts.map((product) => (
                <div key={`all-${product.id}`} className="w-32 flex-shrink-0">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-surface-900 mb-2">
                {searchTerm ? 'No products found' : 'No products available'}
              </h3>
              <p className="text-surface-500 mb-6">
                {searchTerm 
                  ? `No products match your search "${searchTerm}". Try a different keyword or browse categories.`
                  : selectedCategory === 'all'
                    ? 'No products are available at the moment.'
                    : `No products found in ${selectedCategory} category.`
                }
              </p>
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                }}
                className="btn-primary"
              >
                {searchTerm ? 'Clear Search' : 'Show All Products'}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}