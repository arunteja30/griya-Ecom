import React, { useState, useEffect, useContext } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSiteSettings, useNavigation } from "../hooks/useRealtime";
import { CartContext } from "../context/CartContext";

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
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
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

  return (
    <>
      <header
        className={`w-full top-0 z-50 sticky transition-all duration-300 shadow-sm ${
          isSticky ? "glass-effect shadow-lg backdrop-blur-xl bg-white/80" : "bg-[var(--site-nav-bg,theme('colors.primary.50'))]"
        }`}
        style={{ borderBottomColor: 'var(--site-nav-border, rgba(0,0,0,0.06))' }}
      >
        {/* Top row */}
        <div className="section-container">
          <div className="flex items-center gap-4 py-3 lg:py-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 mr-2">
              <img
                src={settings?.logoUrl || "/placeholder.jpg"}
                alt={settings?.brandName || "Brand"}
                className="h-12 w-12 object-cover rounded-md shadow-sm"
              />
              <div className="hidden sm:block">
                <div className="font-bold text-lg" style={{ color: 'var(--site-nav-text, var(--primary-900))', fontFamily: 'Playfair Display, serif' }}>
                  {settings?.brandName || "Griya Jewellery"}
                </div>
                {settings?.tagline && (
                  <div className="text-xs font-medium" style={{ color: 'var(--site-nav-subtext, #6b7280)' }}>{settings.tagline}</div>
                )}
              </div>
            </Link>

            {/* Desktop/tablet inline search (hidden on small screens) */}
            <div className="hidden md:flex flex-1">
              <form onSubmit={handleSearchSubmit} className="flex items-center w-full">
                <div className="relative w-full">
                  <input
                    name="q"
                    placeholder="Search products, categories, brands..."
                    className="form-input header-search w-full pr-12 md:pr-36"
                  />
                  <button
                    type="submit"
                    className="absolute right-1 top-1/2 -translate-y-1/2 btn px-3 md:px-4 py-2 rounded-md"
                    aria-label="Search"
                    style={{ background: 'var(--site-button-bg, var(--site-primary, #111827))', color: 'var(--site-button-text, white)' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.387a1 1 0 01-1.414 1.414l-4.387-4.387zM8 14a6 6 0 100-12 6 6 0 000 12z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </form>
            </div>

            {/* Mobile: title and search bar below logo */}
            <div className="md:hidden flex-1 ml-2">
              <div className="text-base font-semibold text-primary-900">{settings?.brandName || 'Griya Jewellery'}</div>
              <form onSubmit={handleSearchSubmit} className="mt-2">
                <div className="relative">
                  <input name="q" placeholder="Search products, categories, brands..." className="form-input header-search w-full pr-10" />
                  <button type="submit" className="absolute right-1 top-1/2 -translate-y-1/2 btn px-3 py-1 rounded-md" aria-label="Search" style={{ background: 'var(--site-button-bg, var(--site-primary, #111827))', color: 'var(--site-button-text, white)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.387a1 1 0 01-1.414 1.414l-4.387-4.387zM8 14a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>

            {/* Desktop: simplified header — only show cart */}
            <div className="hidden md:flex items-center gap-6 ml-4">
              <Link to="/cart" className="relative flex items-center gap-2">
                <svg className="w-6 h-6 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5 6m0 0h9M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6" />
                </svg>
                <span className="hidden sm:inline text-sm font-medium">Cart</span>
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1" style={{ background: 'var(--site-accent, #FFCC00)' }}>
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>

        {/* Category bar */}
        <div className="hidden md:block w-full border-t border-neutral-200/60 bg-white">
          <div className="container-fluid overflow-x-auto">
            <div className="flex items-center gap-3 py-2 text-sm text-neutral-700">
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
                    className={`px-3 py-1 rounded hover:bg-primary-50 hover:text-primary-600 whitespace-nowrap ${
                      location.pathname === (item.url || item.path) ? "font-semibold text-primary-700" : ""
                    }`}
                  >
                    {item.title || item.label}
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </header>

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