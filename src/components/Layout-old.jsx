import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import TopBanner from "./TopBanner";
import { useSiteSettings } from '../hooks/useRealtime';
import { useCart } from '../context/CartContext';

export default function Layout({ children, className = "", fullWidth = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { cartItems } = useCart();
  const showFooterOnlyOnHome = location.pathname === '/';
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { data: settings } = useSiteSettings();

  useEffect(() => {
    const onToggle = () => setSidebarOpen(s => !s);
    window.addEventListener('toggleSidebar', onToggle);
    return () => window.removeEventListener('toggleSidebar', onToggle);
  }, []);

  // apply theme as CSS variables so child components can use them if needed
  useEffect(() => {
    const theme = settings?.theme;
    if (!theme) return;
    const root = document.documentElement;
    try {
      root.style.setProperty('--app-bg', theme.appBackground || '');
      root.style.setProperty('--primary-color', theme.primaryColor || '');
      root.style.setProperty('--accent-color', theme.accentColor || '');
      root.style.setProperty('--card-bg', theme.cardBgColor || '');
      root.style.setProperty('--card-text', theme.cardTextColor || '');
      root.style.setProperty('--footer-bg', theme.footerBgColor || '');
      root.style.setProperty('--footer-text', theme.footerTextColor || '');
      root.style.setProperty('--nav-bg', theme.navBgColor || '');
      root.style.setProperty('--nav-text', theme.navTextColor || '');
    } catch (e) {
      // ignore if environment prevents styling
    }
  }, [settings]);

  // choose container class: use wide centered container by default, full-width when requested
  const containerClass = fullWidth ? 'w-full px-0' : 'container-fluid mx-auto';

  return (
    <div className="min-h-screen flex flex-col pb-16 md:pb-0" style={{ background: settings?.theme?.appBackground || undefined }}>
      <TopBanner />
      <Navbar />

      <div className={`flex-1 transition-all duration-300 ${className}`}>
        <div className={containerClass}>
          <div className="lg:flex lg:gap-6 w-full mx-auto">

            {/* Main content */}
            <main className="flex-1 min-w-0">
              <div className="rounded-lg p-4 shadow-sm" style={{ background: settings?.theme?.cardBgColor || undefined, color: settings?.theme?.cardTextColor || undefined }}>
                {/* Back button: show on all pages except home and admin routes */}
                {location.pathname !== '/' && !location.pathname.startsWith('/admin') && (
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => navigate(-1)}
                      className="btn btn-ghost px-3 py-1 text-sm"
                      aria-label="Go back"
                    >
                      ← Back
                    </button>
                  </div>
                )}

                {children}
              </div>
            </main>
          </div>
        </div>
      </div>

      {showFooterOnlyOnHome && <Footer />}

      {/* Mobile fixed bottom navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-inner z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-14">
            <Link to="/" className="flex-1 flex flex-col items-center justify-center text-xs text-gray-700 hover:text-gray-900">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10.5z" />
              </svg>
              <span>Home</span>
            </Link>

            <Link to="/collections" className="flex-1 flex flex-col items-center justify-center text-xs text-gray-700 hover:text-gray-900">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>Categories</span>
            </Link>

            <Link to="/cart" className="flex-1 flex flex-col items-center justify-center text-xs text-gray-700 hover:text-gray-900 relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 7h14l-2-7M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
              </svg>
              {cartItems && cartItems.length > 0 && (
                <span className="absolute -top-1 right-6 bg-red-500 text-white text-[10px] rounded-full px-1">{cartItems.length}</span>
              )}
              <span>Cart</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
