import React from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import TopBanner from "./TopBanner";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBanner />
      <Navbar />
      <div className="flex-1 container mx-auto px-4 py-8">{children}</div>
      <Footer />
    </div>
  );
}
