import React from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-white border-r p-4">
        <div className="mb-6 font-bold">Admin Panel</div>
        <nav className="flex flex-col gap-2">
          <Link to="/admin" className="text-sm">Site Settings</Link>
          <Link to="/admin/categories" className="text-sm">Categories</Link>
          <Link to="/admin/products" className="text-sm">Products</Link>
          <Link to="/admin/home" className="text-sm">Homepage Sections</Link>
          <Link to="/admin/gallery" className="text-sm">Gallery</Link>
          <Link to="/admin/testimonials" className="text-sm">Testimonials</Link>
        </nav>
        <div className="mt-6">
          <button className="text-sm text-red-600" onClick={()=>signOut(auth)}>Sign out</button>
        </div>
      </aside>
      <main className="flex-1 p-6 bg-gray-50">{children}</main>
    </div>
  );
}
