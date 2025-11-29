import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFirebaseList } from '../hooks/useFirebase';
import ProductCard from './ProductCard';

export default function RecommendationsSection({ 
  title = "Recommended for You", 
  currentProductId = null, 
  currentCategoryId = null,
  limit = 8,
  showViewAll = true 
}) {
  const { data: productsData } = useFirebaseList("/products");
  
  const recommendedProducts = useMemo(() => {
    if (!productsData) return [];
    
    const products = Object.entries(productsData).map(([k, v]) => ({ ...v, id: k }));
    
    // Filter out current product
    const filteredProducts = products.filter(p => p.id !== currentProductId);
    
    // Create scoring system for recommendations
    const scoredProducts = filteredProducts.map(product => {
      let score = 0;
      
      // Higher score for same category
      if (currentCategoryId && (product.categoryId === currentCategoryId)) {
        score += 3;
      }
      
      // Higher score for products with good ratings
      if (product.rating >= 4) {
        score += 2;
      }
      
      // Higher score for bestsellers
      if (product.isBestseller || product.isPopular) {
        score += 2;
      }
      
      // Higher score for products with high order count
      if (product.orderCount > 10) {
        score += 1;
      }
      
      // Higher score for discounted items
      if (product.discount > 0) {
        score += 1;
      }
      
      // Slight preference for in-stock items
      if (product.inStock !== false) {
        score += 0.5;
      }
      
      // Random factor for variety
      score += Math.random() * 0.5;
      
      return { ...product, score };
    });
    
    // Sort by score and return top items
    return scoredProducts
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }, [productsData, currentProductId, currentCategoryId, limit]);

  if (!recommendedProducts.length) return null;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">{title}</h2>
        {showViewAll && (
          <Link 
            to="/groceries" 
            className="text-orange-600 hover:text-orange-700 text-sm font-medium flex items-center gap-1 transition-colors"
          >
            View All
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>

      {/* Horizontal scrolling recommendations */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {recommendedProducts.map((product) => (
          <div key={product.id} className="w-38 sm:w-46 md:w-40 lg:w-54 flex-shrink-0">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
