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
import CategoriesPage from "./pages/CategoriesPage";
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
import { CartProvider } from "./context/CartContext";import { VariantProvider } from './context/VariantContext';
import { WishlistProvider } from './context/WishlistContext';
import VariantSelector from './components/VariantSelector';import ToastContainer from "./components/Toast";
import CheckoutPage from "./pages/CheckoutPage";
import WishlistPage from "./pages/WishlistPage";
import SearchPage from "./pages/SearchPage";
import SeedSyncAdmin from "./pages/admin/SeedSyncAdmin";
import BannersAdmin from "./pages/admin/BannersAdmin";
import HomeConfigAdmin from "./pages/admin/HomeConfigAdmin";
import ThemeAdmin from "./pages/admin/ThemeAdmin";

export default function App() {
  return (
    <CartProvider>
      <VariantProvider>
        <WishlistProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={<About />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="groceries" element={<AllProductsPage />} />
            <Route path="collections" element={<CollectionsPage />} />
            <Route path="groceries/:categorySlug" element={<CategoryProductsPage />} />
            <Route path="category/:categoryId" element={<CategoryPage />} />
            <Route path="groceries/:categorySlug/:productSlug" element={<ProductDetailPage />} />
            <Route path="product/:productSlug" element={<ProductDetailPage />} />
            <Route path="gallery" element={<GalleryPage />} />
            <Route path="wishlist" element={<WishlistPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="cart" element={<CartPage />} />
          </Route>

          {/* Admin routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminRoute><AdminLayout><SiteSettingsAdmin /></AdminLayout></AdminRoute>} />
          <Route path="/admin/categories" element={<AdminRoute><AdminLayout><CategoriesAdmin /></AdminLayout></AdminRoute>} />
          <Route path="/admin/products" element={<AdminRoute><AdminLayout><ProductsAdmin /></AdminLayout></AdminRoute>} />
          <Route path="/admin/home" element={<AdminRoute><AdminLayout><HomepageAdmin /></AdminLayout></AdminRoute>} />
          <Route path="/admin/gallery" element={<AdminRoute><AdminLayout><GalleryAdmin /></AdminLayout></AdminRoute>} />
          <Route path="/admin/banners" element={<AdminRoute><AdminLayout><BannersAdmin /></AdminLayout></AdminRoute>} />
          <Route path="/admin/home-config" element={<AdminRoute><AdminLayout><HomeConfigAdmin /></AdminLayout></AdminRoute>} />
          <Route path="/admin/testimonials" element={<AdminRoute><AdminLayout><TestimonialsAdmin /></AdminLayout></AdminRoute>} />
          <Route path="/admin/theme" element={<AdminRoute><AdminLayout><ThemeAdmin /></AdminLayout></AdminRoute>} />
          <Route path="/admin/orders" element={<AdminRoute><AdminLayout><OrdersAdmin /></AdminLayout></AdminRoute>} />
          <Route path="/admin/seed" element={<AdminRoute><AdminLayout><SeedSyncAdmin /></AdminLayout></AdminRoute>} />
        </Routes>
        
        {/* Global Variant Selector */}
        <VariantSelector />
        
        <ToastContainer />
        </WishlistProvider>
      </VariantProvider>
    </CartProvider>
  );
}
