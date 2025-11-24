import React, { useState, useEffect, useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSiteSettings, useNavigation } from "../hooks/useRealtime";
import { CartContext } from "../context/CartContext";

export default function Navbar() {
  const { data: settings } = useSiteSettings();
  const { data: navData, loading: navLoading } = useNavigation();
  const [isSticky, setIsSticky] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { cartItems = [] } = useContext(CartContext) || {};
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setIsSticky(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 🔧 Make sure headerNav is ALWAYS an array
  let headerNav = [];
  if (Array.isArray(navData)) {
    headerNav = navData;
  } else if (navData && Array.isArray(navData.header)) {
    // if your hook returns { header: [...] }
    headerNav = navData.header;
  } else if (navData && typeof navData === "object") {
    // if your DB returns navigation as an object { nav1: {...}, nav2: {...} }
    headerNav = Object.values(navData);
  }

  // 🔧 Safer cart count (sum of quantities)
  const cartCount = cartItems.reduce((sum, item) => {
    const qty = typeof item.quantity === "number" ? item.quantity : 1;
    return sum + qty;
  }, 0);

  return (
    <>
      <header
        className={`w-full top-0 z-50 transition-all duration-500 ${
          isSticky
            ? "fixed glass-effect shadow-lg backdrop-blur-xl"
            : "relative bg-transparent"
        }`}
      >
        <div className="section-container">
          <div className="flex items-center justify-between py-4 lg:py-6">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <img
                  src={settings?.logoUrl || "/placeholder.jpg"}
                  alt={settings?.brandName || "Brand"}
                  className="h-12 w-12 object-cover rounded-2xl shadow-md group-hover:shadow-lg transition-all duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-accent-500/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div>
                <div className="font-bold text-lg text-primary-900 font-serif">
                  {settings?.brandName || " "}
                </div>
                {settings?.tagline && (
                  <div className="text-xs text-neutral-500 font-medium">
                    {settings.tagline}
                  </div>
                )}
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-8">
              {navLoading ? (
                <div className="flex space-x-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-4 w-16 bg-neutral-200 rounded animate-pulse"
                    ></div>
                  ))}
                </div>
              ) : (
                headerNav.map((item) => (
                  <Link
                    key={item.id || item.key || item.path}
                    to={item.url || item.path}
                    className={`nav-link ${
                      location.pathname === (item.url || item.path)
                        ? "active text-primary-600"
                        : ""
                    }`}
                  >
                    {item.title || item.label}
                  </Link>
                ))
              )}

              {/* Cart Button */}
              <Link to="/cart" className="relative group">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-700 transition-all duration-200">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5 6m0 0h9M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6"
                    />
                  </svg>
                  <span className="font-medium text-sm">Cart</span>
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-accent-600 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1 animate-bounce-in">
                      {cartCount}
                    </span>
                  )}
                </div>
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <div className="lg:hidden flex items-center gap-3">
              <Link to="/cart" className="relative p-2">
                <svg
                  className="w-6 h-6 text-neutral-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5 6m0 0h9M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6"
                  />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-accent-600 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1">
                    {cartCount}
                  </span>
                )}
              </Link>
              <button
                onClick={() => setMobileOpen(true)}
                className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 transition-colors duration-200"
                aria-label="Open menu"
              >
                <svg
                  className="w-6 h-6 text-neutral-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          ></div>
          <div className="fixed right-0 top-0 h-full w-80 max-w-[85vw] glass-effect shadow-2xl animate-slide-down">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-neutral-200/50">
                <span className="font-bold text-lg text-primary-900">Menu</span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 transition-colors duration-200"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="flex-1 p-6">
                <div className="space-y-2">
                  {navLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-4 w-24 bg-neutral-200 rounded animate-pulse"
                        ></div>
                      ))}
                    </div>
                  ) : (
                    headerNav.map((item, index) => (
                      <Link
                        key={item.id || item.key || item.path}
                        to={item.url || item.path}
                        className="block px-4 py-3 rounded-xl text-neutral-700 hover:bg-primary-50 hover:text-primary-600 transition-all duration-200 font-medium"
                        onClick={() => setMobileOpen(false)}
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        {item.title || item.label}
                      </Link>
                    ))
                  )}

                  {/* Mobile Cart Link */}
                  <Link
                    to="/cart"
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-accent-50 text-accent-700 hover:bg-accent-100 transition-all duration-200 font-medium mt-4"
                    onClick={() => setMobileOpen(false)}
                  >
                    <span>Shopping Cart</span>
                    {cartCount > 0 && (
                      <span className="bg-accent-600 text-white text-xs font-bold rounded-full min-w-[1.5rem] h-6 flex items-center justify-center px-2">
                        {cartCount}
                      </span>
                    )}
                  </Link>
                </div>
              </nav>

              {/* Footer */}
              <div className="p-6 border-t border-neutral-200/50">
                <div className="text-center text-sm text-neutral-500">
                  {settings?.brandName || "Griya Jewellery"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
