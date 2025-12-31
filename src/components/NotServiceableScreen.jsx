import React from 'react';

export default function NotServiceableScreen({ serviceStatus, onRetry }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-green-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-gradient-to-br from-yellow-400/10 to-orange-400/10 rounded-full blur-2xl animate-ping"></div>
      </div>

      <div className="max-w-lg w-full relative z-10">
        {/* Main card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20 text-center relative overflow-hidden">
          {/* Card decoration */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-green-500"></div>
          
          {/* Icon with animation */}
          <div className="relative mx-auto mb-6">
            <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-4xl bg-gradient-to-br from-purple-100 to-purple-200 shadow-lg transform hover:scale-110 transition-transform duration-300">
              🚀
            </div>
            <div className="absolute inset-0 w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-white/50 to-transparent animate-pulse"></div>
          </div>

          {/* Content */}
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            We're Not Here Yet
          </h2>
          
          <p className="text-purple-600 font-medium text-lg mb-6">
            But we're coming soon!
          </p>
          
          <p className="text-gray-600 leading-relaxed mb-8 text-lg">
            We're not servicing your area right now, but we're expanding fast and will be with you soon.
          </p>


          {/* Simple info */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              We're working hard to expand our delivery network to reach you soon.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}