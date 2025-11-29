import React, { useState } from 'react';
import BottomSheet from './BottomSheet';
import FilterBar from './FilterBar';

export default function MobileFilterButton(props) {
  const [open, setOpen] = useState(false);

  const { resultCount } = props;

  return (
    <>
      {/* Floating circular filter button on mobile (bottom-right) */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-16 right-4 z-50 md:hidden flex items-center justify-center bg-white border border-gray-200 rounded-full w-12 h-12 shadow-lg"
        aria-label="Open filters"
      >
        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L15 13.414V19a1 1 0 01-.553.895l-4 2A1 1 0 019 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
        </svg>
        {typeof resultCount === 'number' && (
          <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1">{resultCount}</span>
        )}
      </button>

      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Filters" maxWidth="max-w-xl" footer={null}>
        <div className="p-2">
          <FilterBar {...props} />
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 px-4 py-2 bg-gray-100 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
