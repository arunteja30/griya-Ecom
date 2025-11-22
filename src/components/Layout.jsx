import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import TopBanner from "./TopBanner";

export default function Layout({ children, className = "", fullWidth = false }) {
  const location = useLocation();
  const showFooterOnlyOnHome = location.pathname === '/';
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const onToggle = () => setSidebarOpen(s => !s);
    window.addEventListener('toggleSidebar', onToggle);
    return () => window.removeEventListener('toggleSidebar', onToggle);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <TopBanner />
      <Navbar />

      <div className={`flex-1 transition-all duration-300 ${className}`}>
        <div className="section-container">
          <div className="lg:flex lg:gap-6">
            {/* Sidebar - categories / filters */}
            <aside className={`hidden lg:block lg:w-72 shrink-0 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-6 opacity-0'}`}>
              <div className="sticky top-20 bg-white rounded-lg border p-4 shadow-sm">
                <h3 className="font-semibold mb-3">Categories</h3>
                {/* placeholder - categories will be rendered by pages if needed */}
                <div className="text-sm text-neutral-600">Explore categories from the left. Click a category to filter products.</div>
              </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 min-w-0">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>

      {showFooterOnlyOnHome && <Footer />}

      {/* Mini cart button for quick access (mobile) */}
      <a href="/cart" className="fixed right-4 bottom-6 z-50 lg:hidden bg-accent-600 text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-3">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5 6m0 0h9M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6" />
        </svg>
        <span className="font-medium">Cart</span>
      </a>
    </div>
  );
}
