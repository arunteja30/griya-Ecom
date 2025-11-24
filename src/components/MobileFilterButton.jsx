import React, { useState } from 'react';
import BottomSheet from './BottomSheet';
import FilterBar from './FilterBar';

export default function MobileFilterButton(props) {
  const [open, setOpen] = useState(false);

  const { resultCount } = props;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 md:hidden flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 shadow-lg"
        aria-label="Open filters"
      >
        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L15 13.414V19a1 1 0 01-.553.895l-4 2A1 1 0 019 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
        </svg>
        <span className="text-sm font-medium text-gray-700">Filters</span>
        {typeof resultCount === 'number' && (
          <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">{resultCount}</span>
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
