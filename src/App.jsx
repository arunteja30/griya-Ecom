import React from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import CollectionsPage from "./pages/CollectionsPage";
import CategoryProductsPage from "./pages/CategoryProductsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import GalleryPage from "./pages/GalleryPage";
import CartPage from "./pages/CartPage";
import ContactPage from "./pages/ContactPage";
import AdminRoute from "./components/AdminRoute";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import SiteSettingsAdmin from "./pages/admin/SiteSettingsAdmin";
import CategoriesAdmin from "./pages/admin/CategoriesAdmin";
import ProductsAdmin from "./pages/admin/ProductsAdmin";
import HomepageAdmin from "./pages/admin/HomepageAdmin";
import GalleryAdmin from "./pages/admin/GalleryAdmin";
import TestimonialsAdmin from "./pages/admin/TestimonialsAdmin";
import { CartProvider } from "./context/CartContext";
import ToastContainer from "./components/Toast";

export default function App() {
  return (
    <CartProvider>
      <Routes>
        <Route path="/" element={<Layout fullWidth><HomePage /></Layout>} />
        <Route path="/collections" element={<Layout><CollectionsPage /></Layout>} />
        <Route path="/collections/:categorySlug" element={<Layout><CategoryProductsPage /></Layout>} />
        <Route path="/product/:productSlug" element={<Layout><ProductDetailPage /></Layout>} />
        <Route path="/gallery" element={<Layout><GalleryPage /></Layout>} />
        <Route path="/contact" element={<Layout><ContactPage /></Layout>} />
        <Route path="/cart" element={<Layout><CartPage /></Layout>} />

        {/* Admin routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminRoute><AdminLayout><SiteSettingsAdmin /></AdminLayout></AdminRoute>} />
        <Route path="/admin/categories" element={<AdminRoute><AdminLayout><CategoriesAdmin /></AdminLayout></AdminRoute>} />
        <Route path="/admin/products" element={<AdminRoute><AdminLayout><ProductsAdmin /></AdminLayout></AdminRoute>} />
        <Route path="/admin/home" element={<AdminRoute><AdminLayout><HomepageAdmin /></AdminLayout></AdminRoute>} />
        <Route path="/admin/gallery" element={<AdminRoute><AdminLayout><GalleryAdmin /></AdminLayout></AdminRoute>} />
        <Route path="/admin/testimonials" element={<AdminRoute><AdminLayout><TestimonialsAdmin /></AdminLayout></AdminRoute>} />
      </Routes>
      <ToastContainer />
    </CartProvider>
  );
}
