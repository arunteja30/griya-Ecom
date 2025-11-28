import React from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import TopBanner from "./TopBanner";
import MobileBottomNav from "./MobileBottomNav";
import { ThemeProvider } from '../context/ThemeContext';

export default function Layout({ children, className = "", fullWidth = false }) {
  const location = useLocation();
  const showFooterOnlyOnHome = location.pathname === '/';
  const showMobileNav = location.pathname !== '/cart';

  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--site-bg, var(--gradient-bg))' }}>
        <TopBanner />
        <Navbar />
        <main className={`flex-1 ${fullWidth ? '' : 'container-fluid'} ${className}`}>
          {children}
        </main>
        {showFooterOnlyOnHome && <div className="hidden sm:block"><Footer /></div>}
        {/* Mobile bottom navigation (only visible on small screens) */}
        {showMobileNav && (
          <div className="lg:hidden">
            <MobileBottomNav />
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}
