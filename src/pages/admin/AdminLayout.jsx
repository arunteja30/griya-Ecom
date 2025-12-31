import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';

export default function AdminLayout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const isActiveRoute = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const navItems = [
    { path: '/admin', label: 'Site Settings', icon: '⚙️' },
    { path: '/admin/theme', label: 'Theme', icon: '🎨' },
    { path: '/admin/categories', label: 'Categories', icon: '📦' },
    { path: '/admin/products', label: 'Products', icon: '🛍️' },
    { path: '/admin/home', label: 'Homepage Sections', icon: '🏠' },
    { path: '/admin/home-config', label: 'Homepage Config', icon: '🔧', isSubItem: true },
    { path: '/admin/banners', label: 'Banners', icon: '🖼️' },
    { path: '/admin/gallery', label: 'Gallery', icon: '📸' },
    { path: '/admin/testimonials', label: 'Testimonials', icon: '💬' },
    { path: '/admin/orders', label: 'Orders', icon: '📋' },
    { path: '/admin/seed', label: 'Seed Sync', icon: '🌱' },
  ];

  return (
    <div className="min-h-screen flex bg-surface-50">
      {/* Mobile header */}
      <header className="fixed top-0 left-0 right-0 bg-gradient-to-r from-primary-500 to-fresh-500 text-white shadow-lg z-40 md:hidden flex items-center justify-between px-4 h-16">
        <div className="flex items-center gap-3">
          <button 
            aria-label="Open menu" 
            onClick={() => setDrawerOpen(true)} 
            className="p-2 rounded-xl hover:bg-white/20 transition-colors backdrop-blur-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="font-bold text-lg">Admin Panel</div>
        </div>
        <button 
          className="btn-secondary text-sm" 
          onClick={() => signOut(auth)}
        >
          Sign out
        </button>
      </header>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-50 transition-opacity ${drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} aria-hidden={!drawerOpen}>
        {/* overlay */}
        <div onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        {/* panel */}
        <aside className={`absolute left-0 top-0 bottom-0 w-80 bg-white/95 backdrop-blur-md border-r border-white/20 shadow-2xl transform transition-transform ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-fresh-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">A</span>
                </div>
                <div>
                  <div className="font-bold text-lg text-surface-900">Admin Panel</div>
                  <div className="text-sm text-surface-500">Management Dashboard</div>
                </div>
              </div>
              <button 
                onClick={() => setDrawerOpen(false)} 
                className="p-2 rounded-xl hover:bg-surface-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-surface-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    item.isSubItem ? 'ml-4' : ''
                  } ${
                    isActiveRoute(item.path)
                      ? 'bg-gradient-to-r from-primary-500 to-fresh-500 text-white shadow-lg'
                      : 'text-surface-700 hover:bg-surface-100 hover:text-surface-900'
                  }`}
                  onClick={() => setDrawerOpen(false)}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
            
            <div className="mt-8 pt-6 border-t border-surface-200">
              <button 
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors w-full" 
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
      <aside className="hidden md:block w-80 bg-white/90 backdrop-blur-md border-r border-white/20 shadow-xl">
        <div className="p-6">
          <div className="mb-8 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-fresh-500 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">A</span>
            </div>
            <div>
              <div className="font-bold text-xl text-surface-900">Admin Panel</div>
              <div className="text-sm text-surface-500">Management Dashboard</div>
            </div>
          </div>
          
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  item.isSubItem ? 'ml-4' : ''
                } ${
                  isActiveRoute(item.path)
                    ? 'bg-gradient-to-r from-primary-500 to-fresh-500 text-white shadow-lg'
                    : 'text-surface-700 hover:bg-surface-100 hover:text-surface-900'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          
          <div className="mt-8 pt-6 border-t border-surface-200">
            <button 
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors w-full" 
              onClick={() => signOut(auth)}
            >
              <span className="text-lg">🚪</span>
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6 pt-20 md:pt-6 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
