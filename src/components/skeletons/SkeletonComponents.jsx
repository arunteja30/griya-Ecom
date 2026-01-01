import React from 'react';
import { SkeletonBox, SkeletonText, SkeletonCard } from './SkeletonBase';

// Product card skeleton
export const SkeletonProductCard = ({ className = '' }) => {
  return (
    <SkeletonCard className={`space-y-3 ${className}`}>
      {/* Product image */}
      <SkeletonBox height="h-40" className="rounded-lg" />
      
      {/* Product title */}
      <SkeletonText lines={2} />
      
      {/* Price and rating */}
      <div className="flex items-center justify-between">
        <SkeletonBox width="w-16" height="h-5" />
        <SkeletonBox width="w-12" height="h-4" />
      </div>
      
      {/* Add to cart button */}
      <SkeletonBox height="h-10" className="rounded-lg" />
    </SkeletonCard>
  );
};

// Banner skeleton
export const SkeletonBanner = ({ className = '' }) => {
  return (
    <SkeletonBox height="h-32 md:h-48" className={`rounded-xl ${className}`} />
  );
};

// Category card skeleton
export const SkeletonCategoryCard = ({ className = '' }) => {
  return (
    <SkeletonCard className={`space-y-2 ${className}`}>
      <SkeletonBox height="h-20" className="rounded-lg" />
      <SkeletonText />
    </SkeletonCard>
  );
};

// Product grid skeleton
export const SkeletonProductGrid = ({ count = 6, className = '' }) => {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonProductCard key={i} />
      ))}
    </div>
  );
};

// Category grid skeleton
export const SkeletonCategoryGrid = ({ count = 8, className = '' }) => {
  return (
    <div className={`grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCategoryCard key={i} />
      ))}
    </div>
  );
};