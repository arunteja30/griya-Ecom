import React, { useState, useEffect } from "react";
import { Outlet, useLocation as useRouterLocation, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { useLocation } from "../context/LocationContext";
import { useServiceStatus } from "../context/ServiceStatusContext";
import { useFirebaseObject } from "../hooks/useFirebase";
import { OrderTrackingService } from "../utils/orderTrackingService";
import { getStoreStatus } from "../utils/storeHours";
import AddressSelector from "./AddressSelector";

export default function Layout() {
  const routerLocation = useRouterLocation();
  const location = useLocation();
  const { cart } = useCart();
  const { wishlistCount } = useWishlist();
  const { isServiceable } = useServiceStatus();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: siteSettings } = useFirebaseObject('/siteSettings');
  
  const cartItemCount = cart ? cart.reduce((sum, item) => sum + item.quantity, 0) : 0;
  
  // Get store status
  const storeStatus = getStoreStatus(siteSettings);
  const [latestOrderStatus, setLatestOrderStatus] = useState(null);

  useEffect(() => {
    const update = () => {
      const orders = OrderTrackingService.getActiveOrders();
      setLatestOrderStatus(orders.length > 0 ? orders[0].status : null);
    };
    update();
    window.addEventListener('activeOrdersUpdate', update);
    return () => window.removeEventListener('activeOrdersUpdate', update);
  }, []);

  const statusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-400';
      case 'confirmed': return 'bg-blue-500';
      case 'preparing': return 'bg-purple-500';
      case 'ready': return 'bg-green-500';
      case 'assigned': return 'bg-indigo-500';
      case 'picked': return 'bg-orange-500';
      case 'in-transit': return 'bg-cyan-500';
      case 'delivered': return 'bg-green-600';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

    const isRunningStatus = (status) => {
      return ['pending', 'confirmed', 'preparing', 'assigned', 'picked', 'in-transit'].includes(status);
    };

  // Update document title and favicon based on site settings
  useEffect(() => {
    if (siteSettings?.brandName) {
      document.title = siteSettings.brandName;
    }
    
    // Update favicon if logoUrl is provided
    if (siteSettings?.logoUrl) {
      let favicon = document.querySelector("link[rel*='icon']");
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      favicon.href = siteSettings.logoUrl;
    }
  }, [siteSettings]);

  // Modern Navigation Items
  const navItems = [
    {
      name: 'Home',
      path: '/',
      icon: (active) => (
        <svg className={`w-6 h-6 ${active ? 'text-primary-600' : 'text-surface-500'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      name: 'Categories',
      path: '/categories',
      icon: (active) => (
        <svg className={`w-6 h-6 ${active ? 'text-primary-600' : 'text-surface-500'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      name: 'Search',
      path: '/search',
      icon: (active) => (
        <svg className={`w-6 h-6 ${active ? 'text-primary-600' : 'text-surface-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )
    },
    {
      name: 'Wishlist',
      path: '/wishlist',
      icon: (active) => (
        <div className="relative">
          <svg className={`w-6 h-6 ${active ? 'text-primary-600' : 'text-surface-500'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          {wishlistCount > 0 && (
            <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {wishlistCount > 9 ? '9+' : wishlistCount}
            </div>
          )}
        </div>
      )
    },
    {
      name: 'Cart',
      path: '/cart',
      icon: (active) => (
        <div className="relative">
          <svg className={`w-6 h-6 ${active ? 'text-primary-600' : 'text-surface-500'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5-6M16 16a2 2 0 100 4 2 2 0 000-4zm0 0V9a2 2 0 00-2-2H9m8 7a2 2 0 01-2 2H9a2 2 0 01-2-2" />
          </svg>
          {cartItemCount > 0 && (
            <div className="cart-badge">
              {cartItemCount > 99 ? '99+' : cartItemCount}
            </div>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 to-surface-100">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-surface-200/50">
        <div className="px-mobile py-3">
          <div className="flex items-center justify-between">
            {/* Logo and Location */}
            <div className="flex items-center space-x-3">
              <Link to="/" className="flex items-center space-x-2">
                {siteSettings?.logoUrl ? (
                  <img 
                    src={siteSettings.logoUrl} 
                    alt={siteSettings.brandName || 'Logo'} 
                    className="w-8 h-8 object-contain"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-soft">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7 4V2C7 1.45 7.45 1 8 1H16C16.55 1 17 1.45 17 2V4H20C20.55 4 21 4.45 21 5S20.55 6 20 6H19V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V6H4C3.45 6 3 5.55 3 5S3.45 4 4 4H7ZM9 3V4H15V3H9ZM7 6V19H17V6H7Z"/>
                    </svg>
                  </div>
                )}
                {siteSettings?.brandName && (
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold text-gradient">{siteSettings.brandName}</h1>
                    {storeStatus && (
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                        storeStatus.isOpen 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          storeStatus.isOpen ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                        <span>{storeStatus.isOpen ? 'Open' : 'Closed'}</span>
                      </div>
                    )}
                  </div>
                )}
              </Link>
              
              {/* Location Display */}
              <div className="hidden xs:flex items-center gap-2 text-xs">
                {location.loading ? (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-primary-300 rounded-full animate-pulse"></div>
                    <span className="text-surface-500">Getting location...</span>
                  </div>
                ) : location.error ? (
                  <button 
                    onClick={location.refetch}
                    className="flex items-center gap-1 text-red-600 hover:text-red-700 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M6.938 4h10.124c1.54 0 2.502 1.667 1.732 2.5L12.732 11c.77.833.77 2.167 0 3L18.794 18.5c.77.833-.192 2.5-1.732 2.5H6.938" />
                    </svg>
                    <span>Enable location</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <div className="relative">
                      <div className="w-2 h-2 bg-fresh-500 rounded-full"></div>
                      <div className="absolute inset-0 w-2 h-2 bg-fresh-500 rounded-full animate-ping"></div>
                    </div>
                    <span className="text-surface-700 truncate max-w-24">
                      {location.city || location.area || 'Location'}
                    </span>
                    {/* Store Hours Display */}
                    {storeStatus && (
                      <div className="text-surface-500 text-xs hidden sm:block">
                        • {storeStatus.message}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-3">
              {/* Notifications */}
              <button aria-label="Order status" onClick={() => window.toggleOrderTracker && window.toggleOrderTracker()} className="relative p-2.5 rounded-2xl bg-surface-100 hover:bg-surface-200 transition-colors">
                <svg className="w-5 h-5 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 16V8a2 2 0 00-1-1.73L13 3 4 6.27A2 2 0 003 8v8a2 2 0 001 1.73L11 21l8-3.27A2 2 0 0021 16z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 9l5 3 5-3" />
                </svg>
                {latestOrderStatus ? (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center">
                    <div className="relative">
                      {isRunningStatus(latestOrderStatus) && (
                        <span className="absolute -inset-1 flex items-center justify-center">
                          <span className={`${statusColor(latestOrderStatus)} opacity-60 animate-ping block h-4 w-4 rounded-full`} />
                        </span>
                      )}
                      <div className={`${statusColor(latestOrderStatus)} w-3 h-3 rounded-full`}></div>
                    </div>
                  </div>
                ) : (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent-coral rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sticky Address Selector - Only on Home Page */}
      {routerLocation.pathname === '/' && (
        <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-surface-200/50 shadow-sm">
          <AddressSelector />
        </div>
      )}

      {/* Main Content */}
      <main className="pb-20 min-h-screen">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      {isServiceable && routerLocation.pathname !== '/cart' && routerLocation.pathname !== '/checkout' && (
        <nav className="bottom-nav">
          <div className="flex items-center justify-around">
            {navItems.map((item) => {
              const isActive = routerLocation.pathname === item.path || 
                             (item.path !== '/' && routerLocation.pathname.startsWith(item.path));
              
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={isActive ? 'nav-tab-active' : 'nav-tab'}
                >
                  {item.icon(isActive)}
                  <span className={`text-xs font-medium mt-1 ${
                    isActive ? 'text-primary-600' : 'text-surface-500'
                  }`}>
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-50 bg-surface-900/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-gradient">Menu</h2>
                <button 
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-xl bg-surface-100 hover:bg-surface-200 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Menu Items */}
              <div className="space-y-4">
                <Link 
                  to="/collections" 
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-50 transition-colors group"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-fresh-400 to-fresh-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-surface-900">Collections</h3>
                    <p className="text-sm text-surface-500">Curated products</p>
                  </div>
                </Link>
                
                <Link 
                  to="/about" 
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-50 transition-colors group"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-accent-blue to-primary-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-surface-900">About</h3>
                    <p className="text-sm text-surface-500">Learn more</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}