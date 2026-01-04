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
import AnalyticsAdmin from "./pages/admin/AnalyticsAdmin";
import MerchantDetailsAdmin from "./pages/admin/MerchantDetailsAdmin";
import DriverDetailsAdmin from "./pages/admin/DriverDetailsAdmin";
import SiteSettingsAdmin from "./pages/admin/SiteSettingsAdmin";
import CategoriesAdmin from "./pages/admin/CategoriesAdmin";
import ProductsAdmin from "./pages/admin/ProductsAdmin";
import PromocodesAdmin from "./pages/admin/PromocodesAdmin";
import HomepageAdmin from "./pages/admin/HomepageAdmin";
import GalleryAdmin from "./pages/admin/GalleryAdmin";
import TestimonialsAdmin from "./pages/admin/TestimonialsAdmin";
import OrdersAdmin from "./pages/admin/OrdersAdmin";
import { CartProvider } from "./context/CartContext";import { VariantProvider } from './context/VariantContext';
import { WishlistProvider } from './context/WishlistContext';
import { LocationProvider } from './context/LocationContext';
import { ServiceStatusProvider } from './context/ServiceStatusContext';
import { AdminPermissionProvider } from './context/AdminPermissionContext';
import { AddressProvider } from './context/AddressContext';
import AddressGuard from './components/AddressGuard';
import VariantSelector from './components/VariantSelector';import ToastContainer from "./components/Toast";
import CheckoutPage from "./pages/CheckoutPage";
import WishlistPage from "./pages/WishlistPage";
import SearchPage from "./pages/SearchPage";
import SeedSyncAdmin from "./pages/admin/SeedSyncAdmin";
import BannersAdmin from "./pages/admin/BannersAdmin";
import HomeConfigAdmin from "./pages/admin/HomeConfigAdmin";
import ThemeAdmin from "./pages/admin/ThemeAdmin";
import DriversAdmin from "./pages/admin/DriversAdmin";
import MerchantsAdmin from "./pages/admin/MerchantsAdmin";
import DeliveryPricingAdmin from "./pages/admin/DeliveryPricingAdmin";
import MerchantEarningsAdmin from "./pages/admin/MerchantEarningsAdmin";
import OrderTrackingPage from "./pages/OrderTrackingPage";
import FloatingOrderTracker from "./components/FloatingOrderTracker";
import './utils/devUtils'; // Development utilities
import './utils/orderFlowTest'; // Order flow testing
import './utils/errorHandling'; // Global error handling

export default function App() {
  return (
    <LocationProvider>
      <ServiceStatusProvider>
        <AddressProvider>
          <AddressGuard>
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
            <Route path="track-order" element={<OrderTrackingPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="cart" element={<CartPage />} />
          </Route>

          {/* Admin routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminRoute><AdminPermissionProvider><AdminLayout><SiteSettingsAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
          <Route path="/admin/analytics" element={<AdminRoute><AdminPermissionProvider><AdminLayout><AnalyticsAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
          <Route path="/admin/merchant/:merchantId" element={<AdminRoute><AdminPermissionProvider><AdminLayout><MerchantDetailsAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
          <Route path="/admin/driver/:driverId" element={<AdminRoute><AdminPermissionProvider><AdminLayout><DriverDetailsAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
          <Route path="/admin/categories" element={<AdminRoute><AdminPermissionProvider><AdminLayout><CategoriesAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
          <Route path="/admin/products" element={<AdminRoute><AdminPermissionProvider><AdminLayout><ProductsAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
          <Route path="/admin/promocodes" element={<AdminRoute><AdminPermissionProvider><AdminLayout><PromocodesAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
          <Route path="/admin/home" element={<AdminRoute><AdminPermissionProvider><AdminLayout><HomepageAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
          <Route path="/admin/gallery" element={<AdminRoute><AdminPermissionProvider><AdminLayout><GalleryAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
          <Route path="/admin/banners" element={<AdminRoute><AdminPermissionProvider><AdminLayout><BannersAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
          <Route path="/admin/home-config" element={<AdminRoute><AdminPermissionProvider><AdminLayout><HomeConfigAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
          <Route path="/admin/testimonials" element={<AdminRoute><AdminPermissionProvider><AdminLayout><TestimonialsAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
          <Route path="/admin/theme" element={<AdminRoute><AdminPermissionProvider><AdminLayout><ThemeAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
          <Route path="/admin/orders" element={<AdminRoute><AdminPermissionProvider><AdminLayout><OrdersAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
          <Route path="/admin/drivers" element={<AdminRoute><AdminPermissionProvider><AdminLayout><DriversAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
          <Route path="/admin/merchants" element={<AdminRoute><AdminPermissionProvider><AdminLayout><MerchantsAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
          <Route path="/admin/delivery-pricing" element={<AdminRoute><AdminPermissionProvider><AdminLayout><DeliveryPricingAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
          <Route path="/admin/merchant-earnings" element={<AdminRoute><AdminPermissionProvider><AdminLayout><MerchantEarningsAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
          <Route path="/admin/seed" element={<AdminRoute><AdminPermissionProvider><AdminLayout><SeedSyncAdmin /></AdminLayout></AdminPermissionProvider></AdminRoute>} />
        </Routes>
        
        {/* Global Variant Selector */}
        <VariantSelector />
        
        {/* Floating Order Tracker */}
        <FloatingOrderTracker />
        
            <ToastContainer />
            </WishlistProvider>
          </VariantProvider>
        </CartProvider>
      </AddressGuard>
    </AddressProvider>
    </ServiceStatusProvider>
    </LocationProvider>
  );
}
