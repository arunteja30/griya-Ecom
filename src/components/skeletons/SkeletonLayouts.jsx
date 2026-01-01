import React from 'react';
import { SkeletonBox, SkeletonText, SkeletonCard, SkeletonCircle } from './SkeletonBase';

// Cart item skeleton
export const SkeletonCartItem = ({ className = '' }) => {
  return (
    <SkeletonCard className={`flex items-center space-x-4 ${className}`}>
      <SkeletonBox width="w-16" height="h-16" className="rounded-lg" />
      <div className="flex-1 space-y-2">
        <SkeletonText />
        <div className="flex items-center justify-between">
          <SkeletonBox width="w-20" height="h-4" />
          <SkeletonBox width="w-16" height="h-6" />
        </div>
      </div>
    </SkeletonCard>
  );
};

// Order item skeleton
export const SkeletonOrderItem = ({ className = '' }) => {
  return (
    <SkeletonCard className={`space-y-4 ${className}`}>
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <SkeletonBox width="w-32" height="h-5" />
          <SkeletonText />
        </div>
        <SkeletonBox width="w-20" height="h-6" className="rounded-full" />
      </div>
      
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-3">
            <SkeletonBox width="w-10" height="h-10" className="rounded" />
            <div className="flex-1">
              <SkeletonText />
            </div>
            <SkeletonBox width="w-16" height="h-4" />
          </div>
        ))}
      </div>
      
      <div className="border-t pt-3 flex justify-between">
        <SkeletonBox width="w-16" height="h-5" />
        <SkeletonBox width="w-20" height="h-6" />
      </div>
    </SkeletonCard>
  );
};

// Profile/user skeleton
export const SkeletonProfile = ({ className = '' }) => {
  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      <SkeletonCircle size="w-12 h-12" />
      <div className="space-y-2">
        <SkeletonBox width="w-32" height="h-5" />
        <SkeletonBox width="w-24" height="h-4" />
      </div>
    </div>
  );
};

// Address card skeleton
export const SkeletonAddressCard = ({ className = '' }) => {
  return (
    <SkeletonCard className={`space-y-3 ${className}`}>
      <div className="flex justify-between">
        <SkeletonBox width="w-20" height="h-5" />
        <SkeletonBox width="w-16" height="h-6" className="rounded-full" />
      </div>
      <SkeletonText lines={3} />
      <SkeletonBox width="w-24" height="h-4" />
    </SkeletonCard>
  );
};