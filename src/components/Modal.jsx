import React from 'react';

export default function Modal({ isOpen = true, title, children, onConfirm, onClose, confirmText = 'Confirm', cancelText = 'Cancel', hideActions = false }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose} />
      <div className="relative bg-white rounded shadow-lg w-11/12 max-w-lg mx-auto p-6">
        {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
        <div className="mb-4">{children}</div>
        {!hideActions && (
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded border">{cancelText}</button>
            <button onClick={onConfirm} className="px-4 py-2 rounded bg-red-600 text-white">{confirmText}</button>
          </div>
        )}
      </div>
    </div>
  );
}
