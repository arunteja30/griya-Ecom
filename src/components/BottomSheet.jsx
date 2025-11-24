import React from 'react';
import { Link } from 'react-router-dom';

export default function BottomSheet({ isOpen = false, onClose = () => {}, children, title, footer, maxWidth = 'max-w-3xl' }) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`}
      aria-hidden={!isOpen}
    >
      <div className="bg-black/40 absolute inset-0" onClick={onClose} />
      <div className={`relative bg-white rounded-t-lg shadow-lg p-4 ${maxWidth} mx-auto`}>
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
  );
}
