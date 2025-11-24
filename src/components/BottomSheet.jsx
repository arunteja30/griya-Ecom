import React from 'react';
import { Link } from 'react-router-dom';

export default function BottomSheet({ isOpen = false, onClose = () => {}, children, title, footer, maxWidth = 'max-w-3xl' }) {
  return (
    // full-screen container so overlay blocks entire UI when open
    <div className={`fixed inset-0 z-50 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!isOpen}>
      {/* dimmed overlay covering whole screen */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* sheet container anchored to bottom and sliding up */}
      <div className={`absolute inset-x-0 ${isOpen ? 'bottom-0' : '-bottom-full'} transition-all duration-300`}> 
        <div className={`relative bg-white rounded-t-lg shadow-lg p-4 ${maxWidth} mx-auto`} style={{ maxHeight: '90vh', overflow: 'auto' }}>
          <div className="flex items-start justify-between">
            <div className="text-lg font-semibold">{title || 'Added to cart'}</div>
            <button onClick={onClose} className="text-neutral-500 hover:text-neutral-800">Close</button>
          </div>
          <div className="mt-3">{children}</div>
          {footer ? (
            <div className="mt-4">{footer}</div>
          ) : (
            <div className="mt-4 flex gap-2">
              <Link to="/cart" onClick={onClose} className="btn btn-primary flex-1 text-center">View Cart</Link>
              <Link to="/checkout" onClick={onClose} className="btn btn-ghost flex-1 text-center">Checkout</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
