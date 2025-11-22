import React from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import TopBanner from "./TopBanner";

export default function Layout({ children, className = "", fullWidth = false }) {
  const location = useLocation();
  const showFooterOnlyOnHome = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <TopBanner />
      <Navbar />
      <main className={`flex-1 ${fullWidth ? '' : 'container-fluid'} ${className}`}>
        {children}
      </main>
      {showFooterOnlyOnHome && <Footer />}
    </div>
  );
}
