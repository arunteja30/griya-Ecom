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

  // choose container class: use wide centered container by default, full-width when requested
  const containerClass = fullWidth ? 'w-full px-0' : 'container-fluid mx-auto';

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <TopBanner />
      <Navbar />

      <div className={`flex-1 transition-all duration-300 ${className}`}>
        <div className={containerClass}>
          <div className="lg:flex lg:gap-6 w-full mx-auto">

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
