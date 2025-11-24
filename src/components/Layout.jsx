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
              <div className="sticky top-20">
                {/* sidebar content intentionally removed per request */}
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
    </div>
  );
}
