import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { useSiteSettings, useNavigation } from "../hooks/useRealtime";
import { CartContext } from "../context/CartContext";

export default function Navbar() {
  const { data: settings, loading: settingsLoading } = useSiteSettings();
  const { data: navData, loading: navLoading } = useNavigation();
  const [isSticky, setIsSticky] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { cartItems } = useContext(CartContext);

  useEffect(() => {
    const onScroll = () => setIsSticky(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const headerNav = navData?.header || [];
  const cartCount = cartItems?.length || 0;

  return (
    <header className={`w-full top-0 z-40 transition-all ${isSticky ? 'fixed bg-white shadow-md' : 'relative bg-transparent'}`}>
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src={settings?.logoUrl || '/placeholder.jpg'} alt={settings?.brandName || 'Brand'} className="h-10 w-10 object-cover rounded" />
          <div>
            <div className="font-semibold">{settings?.brandName || 'Brand'}</div>
            <div className="text-xs text-gray-500">{settings?.tagline}</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {navLoading ? (
            <div>Loading...</div>
          ) : (
            headerNav.map((item) => (
              <Link key={item.id} to={item.url} className="text-sm hover:text-gray-700">
                {item.title}
              </Link>
            ))
          )}
          <Link to="/cart" className="relative">
            <span className="inline-block px-3 py-2 border rounded">Cart</span>
            {cartCount > 0 && <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-2">{cartCount}</span>}
          </Link>
        </nav>

        <div className="md:hidden flex items-center gap-3">
          <button onClick={()=>setMobileOpen(true)} className="p-2 border rounded">Menu</button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden" onClick={()=>setMobileOpen(false)}>
          <div className="absolute right-0 top-0 w-3/4 max-w-xs bg-white h-full p-4" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold">Menu</div>
              <button onClick={()=>setMobileOpen(false)} className="text-sm">Close</button>
            </div>
            <nav className="flex flex-col gap-3">
              {headerNav.map((item)=> (
                <Link key={item.id} to={item.url} className="py-2 border-b" onClick={()=>setMobileOpen(false)}>{item.title}</Link>
              ))}
              <Link to="/cart" className="py-2 border-b" onClick={()=>setMobileOpen(false)}>
                Cart {cartCount > 0 && `(${cartCount})`}
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
