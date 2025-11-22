import React from 'react';
export default function Badge({ children, className = '' }) {
  return (
    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full bg-accent text-white ${className}`}>{children}</span>
  );
}
