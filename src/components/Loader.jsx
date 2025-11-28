import React, { useEffect } from "react";

export default function Loader({ size = "default", className = "", text = "", variant = "default" }) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('app-shimmer-styles')) return;
    const style = document.createElement('style');
    style.id = 'app-shimmer-styles';
    style.innerHTML = `
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .shimmer-bg {
        background: linear-gradient(90deg, rgba(0,0,0,0.06) 8%, rgba(255,255,255,0.6) 18%, rgba(0,0,0,0.06) 33%);
        background-size: 200% 100%;
        animation: shimmer 1.2s linear infinite;
      }
      .shimmer-card {
        background: linear-gradient(90deg, #f3f4f6 0%, #e6e7ea 50%, #f3f4f6 100%);
        background-size: 200% 100%;
        animation: shimmer 1.2s linear infinite;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // small/compact sizes for spinner compatibility if needed
  const sizeClasses = {
    sm: "w-6 h-6",
    default: "w-10 h-10",
    lg: "w-14 h-14",
    xl: "w-20 h-20",
  };

  // Simple compact loader (circle) for places expecting spinner
  if (variant === 'compact') {
    return (
      <div className={`flex items-center justify-center py-4 ${className}`}>
        <div className={`rounded-full ${sizeClasses[size]} shimmer-bg`} />
      </div>
    );
  }

  // Card-style skeleton used as default for pages
  return (
    <div className={`flex flex-col items-center justify-center py-8 ${className}`}>
      <div className="w-full max-w-4xl mx-auto">
        {/* Large hero skeleton */}
        <div className="w-full h-44 rounded-xl shimmer-card" />

        {/* Row of skeleton cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="w-full h-36 rounded-lg shimmer-card" />
              <div className="h-3 rounded shimmer-bg w-3/4"></div>
              <div className="h-3 rounded shimmer-bg w-1/2"></div>
            </div>
          ))}
        </div>

        {text && <p className="mt-4 text-sm text-neutral-500 text-center animate-pulse">{text}</p>}
      </div>
    </div>
  );
}
