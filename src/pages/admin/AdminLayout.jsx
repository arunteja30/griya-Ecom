import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';

export default function AdminLayout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const isActiveRoute = (path) => {
    // Exact match for the base admin path (Site Settings)
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    // For other paths, check if pathname starts with the path
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const navItems = [
    { path: '/admin', label: 'Site Settings', icon: '⚙️' },
    { path: '/admin/theme', label: 'Theme', icon: '🎨' },
    { path: '/admin/categories', label: 'Categories', icon: '📦' },
    { path: '/admin/products', label: 'Products', icon: '🛍️' },
    { path: '/admin/promocodes', label: 'Promo Codes', icon: '🏷️' },
    { path: '/admin/home', label: 'Homepage Sections', icon: '🏠' },
    { path: '/admin/home-config', label: 'Homepage Config', icon: '🔧', isSubItem: true },
    { path: '/admin/banners', label: 'Banners', icon: '🖼️' },
    { path: '/admin/gallery', label: 'Gallery', icon: '📸' },
    { path: '/admin/testimonials', label: 'Testimonials', icon: '💬' },
    { path: '/admin/orders', label: 'Orders', icon: '📋' },
    { path: '/admin/drivers', label: 'Drivers', icon: '🚗' },
    { path: '/admin/merchants', label: 'Merchants', icon: '🏪' },
    { path: '/admin/seed', label: 'Seed Sync', icon: '🌱' },
  ];

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Mobile header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-white/20 shadow-lg z-40 md:hidden flex items-center justify-between px-6 h-16">
        <div className="flex items-center gap-3">
          <button 
            aria-label="Open menu" 
            onClick={() => setDrawerOpen(true)} 
            className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">G</span>
            </div>
            <div className="font-bold text-lg bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Griya Admin</div>
          </div>
        </div>
        <button 
          className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg text-sm font-medium hover:from-red-600 hover:to-pink-700 transition-all duration-200 shadow-lg" 
          onClick={() => signOut(auth)}
        >
          Sign out
        </button>
      </header>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-50 transition-all duration-300 ${drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} aria-hidden={!drawerOpen}>
        {/* overlay */}
        <div onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md"></div>
        {/* panel */}
        <aside className={`absolute left-0 top-0 bottom-0 w-80 bg-white/95 backdrop-blur-xl border-r border-white/30 shadow-2xl transform transition-all duration-300 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">G</span>
                </div>
                <div>
                  <div className="font-bold text-lg bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Griya Admin</div>
                  <div className="text-sm text-gray-500">Management Dashboard</div>
                </div>
              </div>
              <button 
                onClick={() => setDrawerOpen(false)} 
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden ${
                    item.isSubItem ? 'ml-4' : ''
                  } ${
                    isActiveRoute(item.path)
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg transform scale-[1.02]'
                      : 'text-gray-700 hover:bg-white/60 hover:text-gray-900 hover:shadow-md'
                  }`}
                  onClick={() => setDrawerOpen(false)}
                >
                  <span className={`text-lg transition-transform group-hover:scale-110 ${
                    isActiveRoute(item.path) ? 'drop-shadow-sm' : ''
                  }`}>{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                  {isActiveRoute(item.path) && (
                    <div className="absolute right-2">
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </Link>
              ))}
            </nav>
            
            <div className="mt-8 pt-6 border-t border-gray-200">
              <button 
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-red-500 to-pink-600 text-white hover:from-red-600 hover:to-pink-700 transition-all duration-200 w-full shadow-lg" 
                onClick={() => { setDrawerOpen(false); signOut(auth); }}
              >
                <span className="text-lg">🚪</span>
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:block w-80 bg-white/90 backdrop-blur-xl border-r border-white/30 shadow-xl">
        <div className="p-6 h-full flex flex-col">
          <div className="mb-8 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">G</span>
            </div>
            <div>
              <div className="font-bold text-xl bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Griya Admin</div>
              <div className="text-sm text-gray-500">Management Dashboard</div>
            </div>
          </div>
          
          <nav className="flex-1 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden ${
                  item.isSubItem ? 'ml-4' : ''
                } ${
                  isActiveRoute(item.path)
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg transform scale-[1.02]'
                    : 'text-gray-700 hover:bg-white/60 hover:text-gray-900 hover:shadow-md'
                }`}
              >
                <span className={`text-lg transition-transform group-hover:scale-110 ${
                  isActiveRoute(item.path) ? 'drop-shadow-sm' : ''
                }`}>{item.icon}</span>
                <span className="font-medium">{item.label}</span>
                {isActiveRoute(item.path) && (
                  <div className="absolute right-2">
                    <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                  </div>
                )}
              </Link>
            ))}
          </nav>
          
          <div className="mt-auto pt-6 border-t border-gray-200">
            <button 
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-red-500 to-pink-600 text-white hover:from-red-600 hover:to-pink-700 transition-all duration-200 w-full shadow-lg" 
              onClick={() => signOut(auth)}
            >
              <span className="text-lg">🚪</span>
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6 pt-20 md:pt-6 overflow-auto bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
