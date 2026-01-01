import React from 'react';

// Base shimmer animation component
export const SkeletonBase = ({ className = '', children, ...props }) => {
  return (
    <div
      className={`skeleton ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

// Simple rectangular skeleton
export const SkeletonBox = ({ width = 'w-full', height = 'h-4', className = '', ...props }) => {
  return (
    <SkeletonBase
      className={`rounded ${width} ${height} ${className}`}
      {...props}
    />
  );
};

// Text line skeleton
export const SkeletonText = ({ lines = 1, className = '', ...props }) => {
  if (lines === 1) {
    return <SkeletonBox height="h-4" className={className} {...props} />;
  }
  
  return (
    <div className={`space-y-2 ${className}`} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          height="h-4"
          width={i === lines - 1 ? 'w-3/4' : 'w-full'}
        />
      ))}
    </div>
  );
};

// Circle/avatar skeleton
export const SkeletonCircle = ({ size = 'w-10 h-10', className = '', ...props }) => {
  return (
    <SkeletonBase
      className={`rounded-full ${size} ${className}`}
      {...props}
    />
  );
};

// Card container skeleton
export const SkeletonCard = ({ children, className = '', ...props }) => {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-surface-200 p-4 ${className}`} {...props}>
      {children}
    </div>
  );
};