import React from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import About from "./pages/About";
import CollectionsPage from "./pages/CollectionsPage";
import AllProductsPage from "./pages/AllProductsPage";
import CategoryProductsPage from "./pages/CategoryProductsPage";
import CategoryPage from "./pages/CategoryPage";
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
import OrdersAdmin from "./pages/admin/OrdersAdmin";
import { CartProvider } from "./context/CartContext";
import ToastContainer from "./components/Toast";
import CheckoutPage from "./pages/CheckoutPage";
import SeedSyncAdmin from "./pages/admin/SeedSyncAdmin";

export default function App() {
  return (
    <CartProvider>
      <Routes>
        <Route path="/" element={<Layout fullWidth><HomePage /></Layout>} />
        <Route path="/about" element={<Layout><About /></Layout>} />
        <Route path="/groceries" element={<Layout><AllProductsPage /></Layout>} />
        <Route path="/groceries/:categorySlug" element={<Layout><CategoryProductsPage /></Layout>} />
        <Route path="/category/:categoryId" element={<Layout><CategoryPage /></Layout>} />

        {/* Grocery product route */}
        <Route path="/groceries/:categorySlug/:productSlug" element={<Layout><ProductDetailPage /></Layout>} />

        <Route path="/product/:productSlug" element={<Layout><ProductDetailPage /></Layout>} />
        <Route path="/gallery" element={<Layout><GalleryPage /></Layout>} />
        <Route path="/checkout" element={<Layout><CheckoutPage /></Layout>} />
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
        <Route path="/admin/orders" element={<AdminRoute><AdminLayout><OrdersAdmin /></AdminLayout></AdminRoute>} />
        <Route path="/admin/seed" element={<AdminRoute><AdminLayout><SeedSyncAdmin /></AdminLayout></AdminRoute>} />
      </Routes>
      <ToastContainer />
    </CartProvider>
  );
}
