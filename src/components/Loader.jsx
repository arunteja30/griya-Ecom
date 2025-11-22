import React from "react";

export default function Loader({ size = "default", className = "", text = "" }) {
  const sizeClasses = {
    sm: "w-4 h-4",
    default: "w-8 h-8",
    lg: "w-12 h-12",
    xl: "w-16 h-16"
  };

  return (
    <div className={`flex flex-col items-center justify-center py-8 ${className}`}>
      <div className="relative">
        {/* Outer ring */}
        <div className={`${sizeClasses[size]} rounded-full border-4 border-primary-100 border-t-primary-600 animate-spin`}></div>
        {/* Inner ring */}
        <div className={`absolute inset-2 rounded-full border-2 border-accent-100 border-b-accent-500 animate-spin`} 
             style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1 h-1 bg-primary-600 rounded-full animate-pulse"></div>
        </div>
      </div>
      {text && (
        <p className="mt-4 text-sm text-neutral-600 animate-pulse">{text}</p>
      )}
    </div>
  );
}
