import React, { useState, useEffect, useContext } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSiteSettings, useNavigation } from "../hooks/useRealtime";
import { CartContext } from "../context/CartContext";
import UniversalImage from "./UniversalImage";

export default function Navbar() {
  const { data: settings } = useSiteSettings();
  const { data: navData, loading: navLoading } = useNavigation();
  const [isSticky, setIsSticky] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { cartItems = [] } = useContext(CartContext) || {};
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setIsSticky(window.scrollY > 60);
    // Only enable scroll-based sticky behavior on md+ (desktop/tablet). On mobile we keep navbar static to avoid movement.
    const handleAdd = () => {
      if (window.matchMedia('(min-width: 768px)').matches) {
        window.addEventListener('scroll', onScroll);
      }
    };
    handleAdd();
    const mm = window.matchMedia('(min-width: 768px)');
    const onMedia = (e) => {
      if (e.matches) window.addEventListener('scroll', onScroll);
      else window.removeEventListener('scroll', onScroll);
    };
    mm.addEventListener('change', onMedia);
    return () => {
      window.removeEventListener('scroll', onScroll);
      mm.removeEventListener('change', onMedia);
    };
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    const q = (form.q?.value || '').trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  // Normalize nav data
  let headerNav = [];
  if (Array.isArray(navData)) headerNav = navData;
  else if (navData && Array.isArray(navData.header)) headerNav = navData.header;
  else if (navData && typeof navData === "object") headerNav = Object.values(navData);

  const cartCount = cartItems.reduce((sum, item) => {
    const qty = typeof item.quantity === "number" ? item.quantity : 1;
    return sum + qty;
  }, 0);

  // detect if current route is home
  const isHome = location.pathname === '/' || location.pathname === '/home';

  // add/remove a body class so other components/CSS can react (show mobile hero only on home)
  React.useEffect(() => {
    try {
      if (typeof document !== 'undefined') {
        if (isHome) document.body.classList.add('is-home');
        else document.body.classList.remove('is-home');
      }
    } catch (e) {
      // ignore
    }
    return () => {};
  }, [isHome]);

  // Helper: derive a friendly page title from the path for the mobile action bar
  const getMobileTitle = (pathname) => {
    try {
      const parts = pathname.split('/').filter(Boolean);
      if (!parts.length) return settings?.brandName || 'Griya';
      const last = parts[parts.length - 1];
      const decoded = decodeURIComponent(last.replace(/\+/g, ' '));
      return decoded.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    } catch (e) {
      return settings?.brandName || 'Griya';
    }
  };

  return (
    <>
      <header
        className={`fixed md:sticky left-0 right-0 w-full top-0 z-50 transition-all duration-300 ${
          isSticky 
            ? "backdrop-blur-xl bg-white/95 shadow-lg border-b border-accent-100" 
            : "bg-white shadow-md border-b border-neutral-100"
        }`}
      >
        {/* Top row - Elegant Jewelry Store Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 py-3 lg:py-4">
            {/* Elegant Logo or Back Button on inner pages */}
            {isHome ? (
              <Link to="/" className="flex items-center gap-3 mr-2 group">
              <div className="relative">
                <UniversalImage
                  src={settings?.logoUrl || "/placeholder.jpg"}
                  alt={settings?.brandName || "Brand"}
                  className="h-14 w-14 md:h-12 md:w-12 object-cover rounded-lg shadow-md border border-accent-100 transition-transform duration-300 group-hover:scale-105"
                  fallback={'/placeholder.jpg'}
                />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-accent-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div className="hidden sm:block">
                <div 
                  className="font-bold text-xl tracking-wide"
                  style={{ 
                    fontFamily: 'Cormorant Garamond, serif',
                    color: '#1a1d20',
                    letterSpacing: '0.5px'
                  }}
                >
                  {settings?.brandName || "Griya Jewellery"}
                </div>
                {settings?.tagline && (
                  <div className="text-xs font-medium text-accent-600" style={{ letterSpacing: '0.5px' }}>
                    {settings.tagline}
                  </div>
                )}
              </div>
            </Link>
            ) : (
              <div className="mr-2 hidden md:block">
                <button
                  onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }}
                  className="p-2 rounded-md hover:bg-neutral-100"
                  aria-label="Back"
                >
                  <svg className="w-6 h-6 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
            )}

            {/* Elegant Search Bar - Desktop/Tablet */}
            <div className="hidden md:flex flex-1 max-w-2xl mx-4">
              <form onSubmit={handleSearchSubmit} className="flex items-center w-full">
                <div className="relative w-full">
                  <input
                    name="q"
                    placeholder="Search for exquisite jewelry..."
                    className="w-full px-5 py-2.5 pr-12 rounded-lg border border-neutral-200 focus:border-accent-400 focus:ring-4 focus:ring-accent-100 transition-all duration-300 text-sm bg-neutral-50 focus:bg-white"
                    style={{ letterSpacing: '0.3px' }}
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md transition-all duration-300 hover:bg-accent-50"
                    aria-label="Search"
                  >
                    <svg className="h-5 w-5 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>

            {/* Mobile: Compact Branding or Action Bar on inner pages */}
            <div className="md:hidden flex-1">
              { isHome ? (
                <div 
                  className="text-2xl font-bold"
                  style={{ 
                    fontFamily: 'Cormorant Garamond, serif',
                    color: '#1a1d20'
                  }}
                >
                  {settings?.brandName || 'Griya'}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }}
                    className="p-2 rounded-md hover:bg-neutral-100"
                    aria-label="Back"
                  >
                    <svg className="w-5 h-5 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <div className="flex-1 text-center px-2">
                    <div className="text-2xl font-bold line-clamp-1" style={{ fontFamily: 'Cormorant Garamond, serif', color: '#1a1d20' }}>{getMobileTitle(location.pathname)}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => navigate('/search')} className="p-2 rounded-md hover:bg-neutral-100" aria-label="Search">
                      <svg className="w-5 h-5 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>

                    <Link to="/cart" className="relative p-2 rounded-md hover:bg-neutral-100">
                      <svg className="w-5 h-5 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                      {cartCount > 0 && (
                        <span className="absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1.5 shadow-md" style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #f9d77e 100%)', color: '#1a1d20' }}>{cartCount}</span>
                      )}
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Action Icons - Elegant */}
            <div className="flex items-center gap-3 md:gap-4">
              {/* Desktop cart (hidden on mobile to avoid duplication) */}
              <Link 
                to="/cart" 
                className="hidden md:flex relative items-center gap-2 group px-3 py-2 rounded-lg hover:bg-accent-50 transition-all duration-300"
              >
                <svg className="w-6 h-6 text-neutral-700 group-hover:text-accent-600 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span className="hidden lg:inline text-sm font-semibold text-neutral-700 group-hover:text-accent-600 transition-colors duration-300" style={{ letterSpacing: '0.5px' }}>
                  Cart
                </span>
                {cartCount > 0 && (
                  <span 
                    className="absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1.5 shadow-md"
                    style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #f9d77e 100%)', color: '#1a1d20' }}
                  >
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden px-4 pb-3">
          <form onSubmit={handleSearchSubmit}>
            <div className="relative">
              <input 
                name="q" 
                placeholder="Search jewelry..." 
                className="w-full px-4 py-2 pr-10 rounded-lg border border-neutral-200 focus:border-accent-400 focus:ring-2 focus:ring-accent-100 text-sm bg-neutral-50 focus:bg-white transition-all duration-300" 
              />
              <button 
                type="submit" 
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-accent-50 transition-colors duration-300" 
                aria-label="Search"
              >
                <svg className="h-4 w-4 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>
        </div>

        {/* Elegant Navigation Bar - Desktop */}
        <div className="hidden md:block border-t border-neutral-100 bg-gradient-to-b from-white to-neutral-50/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center gap-1 py-3 overflow-x-auto">
              {navLoading ? (
                <div className="flex gap-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-6 w-20 bg-neutral-200 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                headerNav.map((item) => (
                  <Link
                    key={item.id || item.key || item.path}
                    to={item.url || item.path}
                    className={`px-4 py-2 rounded-lg text-lg font-semibold transition-all duration-300 whitespace-nowrap ${
                      location.pathname === (item.url || item.path)
                        ? "bg-accent-50 text-accent-700"
                        : "text-neutral-700 hover:bg-neutral-50 hover:text-accent-600"
                    }`}
                    style={{ letterSpacing: '0.5px' }}
                  >
                    {item.title || item.label}
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Mobile spacer to prevent content being hidden under the fixed header */}
      <div className="md:hidden h-20" aria-hidden />

      {/* Mobile Menu Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="fixed right-0 top-0 h-full w-80 max-w-[85vw] glass-effect shadow-2xl animate-slide-down" role="dialog" aria-modal="true">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-6 border-b border-neutral-200/50">
                <span className="font-bold text-lg text-primary-900">Menu</span>
                <button onClick={() => setMobileOpen(false)} className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 transition-colors duration-200" aria-label="Close menu">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <nav className="flex-1 p-6 overflow-y-auto">
                <div className="space-y-2">
                  {navLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => <div key={i} className="h-4 w-24 bg-neutral-200 rounded animate-pulse" />)}
                    </div>
                  ) : (
                    headerNav.map((item, index) => (
                      <Link
                        key={item.id || item.key || item.path}
                        to={item.url || item.path}
                        className="block px-4 py-3 rounded-xl text-neutral-700 hover:bg-primary-50 hover:text-primary-600 transition-all duration-200 font-medium"
                        onClick={() => setMobileOpen(false)}
                        style={{ animationDelay: `${index * 0.06}s` }}
                      >
                        {item.title || item.label}
                      </Link>
                    ))
                  )}

                  <Link to="/cart" className="flex items-center justify-between px-4 py-3 rounded-xl bg-accent-50 text-accent-700 hover:bg-accent-100 transition-all duration-200 font-medium mt-4" onClick={() => setMobileOpen(false)}>
                    <span>Shopping Cart</span>
                    {cartCount > 0 && <span className="bg-accent-600 text-white text-xs font-bold rounded-full min-w-[1.5rem] h-6 flex items-center justify-center px-2">{cartCount}</span>}
                  </Link>
                </div>
              </nav>

              <div className="p-6 border-t border-neutral-200/50">
                <div className="text-center text-sm text-neutral-500">{settings?.brandName || "Griya Jewellery"}</div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
