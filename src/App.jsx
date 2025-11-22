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

export default function App() {
  return (
    <CartProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/collections/:categorySlug" element={<CategoryProductsPage />} />
          <Route path="/product/:productSlug" element={<ProductDetailPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/cart" element={<CartPage />} />

          {/* Admin routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminRoute><AdminLayout><SiteSettingsAdmin /></AdminLayout></AdminRoute>} />
          <Route path="/admin/categories" element={<AdminRoute><AdminLayout><CategoriesAdmin /></AdminLayout></AdminRoute>} />
          <Route path="/admin/products" element={<AdminRoute><AdminLayout><ProductsAdmin /></AdminLayout></AdminRoute>} />
          <Route path="/admin/home" element={<AdminRoute><AdminLayout><HomepageAdmin /></AdminLayout></AdminRoute>} />
          <Route path="/admin/gallery" element={<AdminRoute><AdminLayout><GalleryAdmin /></AdminLayout></AdminRoute>} />
          <Route path="/admin/testimonials" element={<AdminRoute><AdminLayout><TestimonialsAdmin /></AdminLayout></AdminRoute>} />
        </Routes>
      </Layout>
    </CartProvider>
  );
}
