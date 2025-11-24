import React, { useState } from 'react';

export default function BannerForm({ initialValues = {}, onSubmit, busy }) {
  const [values, setValues] = useState({
    title: initialValues.title || '',
    subtitle: initialValues.subtitle || '',
    image: initialValues.image || '',
    ctaLink: initialValues.ctaLink || '',
    startDate: initialValues.startDate || '',
    endDate: initialValues.endDate || ''
  });
  const [errors, setErrors] = useState({});

  const handleChange = (k) => (e) => setValues(v => ({ ...v, [k]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!values.title || !values.title.trim()) errs.title = 'Title is required';
    if (!values.image || !values.image.trim()) errs.image = 'Image URL is required';
    // validate dates
    if (values.startDate && values.endDate) {
      const s = new Date(values.startDate);
      const e = new Date(values.endDate);
      if (s.toString() === 'Invalid Date' || e.toString() === 'Invalid Date') {
        errs.dates = 'Invalid date format';
      } else if (s > e) {
        errs.dates = 'Start date must be before end date';
      }
    }
    // validate ctaLink (allow internal paths or http/https)
    if (values.ctaLink && values.ctaLink.trim()) {
      const v = values.ctaLink.trim();
      if (!v.startsWith('/') && !v.startsWith('http://') && !v.startsWith('https://')) {
        errs.ctaLink = 'CTA must be a relative path or full http(s) URL';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (busy) return;
    if (!validate()) return;
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700">Title</label>
        <input value={values.title} onChange={handleChange('title')} className="w-full border px-3 py-2 rounded" />
        {errors.title && <div className="text-sm text-red-600 mt-1">{errors.title}</div>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Subtitle</label>
        <input value={values.subtitle} onChange={handleChange('subtitle')} className="w-full border px-3 py-2 rounded" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Image (URL)</label>
        <input value={values.image} onChange={handleChange('image')} className="w-full border px-3 py-2 rounded" />
        {errors.image && <div className="text-sm text-red-600 mt-1">{errors.image}</div>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">CTA Link</label>
        <input value={values.ctaLink} onChange={handleChange('ctaLink')} className="w-full border px-3 py-2 rounded" />
        {errors.ctaLink && <div className="text-sm text-red-600 mt-1">{errors.ctaLink}</div>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Start Date</label>
        <input type="date" value={values.startDate} onChange={handleChange('startDate')} className="w-full border px-3 py-2 rounded" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">End Date</label>
        <input type="date" value={values.endDate} onChange={handleChange('endDate')} className="w-full border px-3 py-2 rounded" />
        {errors.dates && <div className="text-sm text-red-600 mt-1">{errors.dates}</div>}
      </div>
      <div className="flex gap-2">
        <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
      </div>
    </form>
  );
}
