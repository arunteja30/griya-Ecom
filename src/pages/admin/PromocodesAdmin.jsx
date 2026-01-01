import React, { useState, useEffect } from 'react';
import { ref, onValue, push, update, remove, query, orderByChild } from 'firebase/database';
import { db } from '../../firebase';
import AdminCard from './AdminCard';
import { showToast } from '../../components/Toast';

export default function PromocodesAdmin() {
  const [promocodes, setPromocodes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [form, setForm] = useState({
    code: '',
    description: '',
    discountType: 'percent', // 'percent' or 'flat'
    discountValue: '',
    startDate: '',
    endDate: '',
    maxUses: '',
    usedCount: 0,
    minOrderAmount: '',
    maxDiscountAmount: '',
    isActive: true,
    applicableCategories: '',
    applicableProducts: ''
  });

  // Load promocodes
  useEffect(() => {
    const promocodesRef = ref(db, 'promocodes');
    const unsubscribe = onValue(promocodesRef, (snapshot) => {
      if (snapshot.exists()) {
        const promocodesData = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data
        })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setPromocodes(promocodesData);
      } else {
        setPromocodes([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setForm({
      code: '',
      description: '',
      discountType: 'percent',
      discountValue: '',
      startDate: '',
      endDate: '',
      maxUses: '',
      usedCount: 0,
      minOrderAmount: '',
      maxDiscountAmount: '',
      isActive: true,
      applicableCategories: '',
      applicableProducts: ''
    });
    setEditingPromo(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!form.code.trim()) {
      showToast('Promo code is required', 'error');
      return;
    }
    
    if (!form.discountValue || parseFloat(form.discountValue) <= 0) {
      showToast('Valid discount value is required', 'error');
      return;
    }

    setSaving(true);
    
    try {
      const promoData = {
        code: form.code.toUpperCase().trim(),
        description: form.description?.trim() || '',
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        usedCount: editingPromo ? (parseInt(form.usedCount) || 0) : 0,
        minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : 0,
        maxDiscountAmount: form.maxDiscountAmount ? parseFloat(form.maxDiscountAmount) : null,
        startDate: form.startDate ? new Date(form.startDate).getTime() : null,
        endDate: form.endDate ? new Date(form.endDate).getTime() : null,
        isActive: form.isActive,
        applicableCategories: form.applicableCategories?.trim() || '',
        applicableProducts: form.applicableProducts?.trim() || '',
        updatedAt: Date.now()
      };

      console.log('Saving promo data:', promoData);

      if (editingPromo) {
        const promoRef = ref(db, `promocodes/${editingPromo.id}`);
        await update(promoRef, promoData);
        showToast('Promo code updated successfully', 'success');
      } else {
        const promocodesRef = ref(db, 'promocodes');
        await push(promocodesRef, {
          ...promoData,
          createdAt: Date.now()
        });
        showToast('Promo code created successfully', 'success');
      }

      setShowForm(false);
      resetForm();
    } catch (error) {
      console.error('Error saving promo code:', error);
      showToast(`Error saving promo code: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (promo) => {
    setEditingPromo(promo);
    setForm({
      code: promo.code || '',
      description: promo.description || '',
      discountType: promo.discountType || 'percent',
      discountValue: promo.discountValue?.toString() || '',
      startDate: promo.startDate ? new Date(promo.startDate).toISOString().split('T')[0] : '',
      endDate: promo.endDate ? new Date(promo.endDate).toISOString().split('T')[0] : '',
      maxUses: promo.maxUses?.toString() || '',
      usedCount: promo.usedCount || 0,
      minOrderAmount: promo.minOrderAmount?.toString() || '',
      maxDiscountAmount: promo.maxDiscountAmount?.toString() || '',
      isActive: promo.isActive !== false,
      applicableCategories: promo.applicableCategories || '',
      applicableProducts: promo.applicableProducts || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this promo code?')) return;
    
    try {
      const promoRef = ref(db, `promocodes/${id}`);
      await remove(promoRef);
      showToast('Promo code deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting promo code:', error);
      showToast('Error deleting promo code', 'error');
    }
  };

  const toggleStatus = async (promo) => {
    try {
      const promoRef = ref(db, `promocodes/${promo.id}`);
      await update(promoRef, {
        isActive: !promo.isActive,
        updatedAt: Date.now()
      });
      showToast(`Promo code ${!promo.isActive ? 'activated' : 'deactivated'}`, 'success');
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Error updating status', 'error');
    }
  };

  const getStatusColor = (promo) => {
    const now = new Date();
    const startDate = promo.startDate ? new Date(promo.startDate) : null;
    const endDate = promo.endDate ? new Date(promo.endDate) : null;
    
    if (!promo.isActive) return 'bg-gray-100 text-gray-800';
    if (startDate && now < startDate) return 'bg-blue-100 text-blue-800';
    if (endDate && now > endDate) return 'bg-red-100 text-red-800';
    if (promo.maxUses && promo.usedCount >= promo.maxUses) return 'bg-red-100 text-red-800';
    
    return 'bg-green-100 text-green-800';
  };

  const getStatusText = (promo) => {
    const now = new Date();
    const startDate = promo.startDate ? new Date(promo.startDate) : null;
    const endDate = promo.endDate ? new Date(promo.endDate) : null;
    
    if (!promo.isActive) return 'Inactive';
    if (startDate && now < startDate) return 'Scheduled';
    if (endDate && now > endDate) return 'Expired';
    if (promo.maxUses && promo.usedCount >= promo.maxUses) return 'Used Up';
    
    return 'Active';
  };

  const filteredPromocodes = promocodes.filter(promo =>
    promo.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    promo.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminCard title="Promo Codes" subtitle="Manage discount codes and promotional offers">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search promo codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Promo Code
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600">Total Codes</p>
                <p className="text-2xl font-bold text-blue-900">{promocodes.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600">Active</p>
                <p className="text-2xl font-bold text-green-900">
                  {promocodes.filter(p => p.isActive && getStatusText(p) === 'Active').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="ml-4">
                <p className="text-sm font-medium text-yellow-600">Scheduled</p>
                <p className="text-2xl font-bold text-yellow-900">
                  {promocodes.filter(p => getStatusText(p) === 'Scheduled').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div className="ml-4">
                <p className="text-sm font-medium text-red-600">Expired/Used Up</p>
                <p className="text-2xl font-bold text-red-900">
                  {promocodes.filter(p => ['Expired', 'Used Up'].includes(getStatusText(p))).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Promocodes List */}
        {loading ? (
          <div className="text-center py-12">
            <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-500">Loading promo codes...</p>
          </div>
        ) : filteredPromocodes.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No promo codes found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Get started by creating your first promo code'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Promo Code
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPromocodes.map((promo) => (
              <div key={promo.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-bold text-gray-900 font-mono bg-gray-100 px-3 py-1 rounded">
                        {promo.code}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(promo)}`}>
                        {getStatusText(promo)}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        promo.discountType === 'percent' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {promo.discountType === 'percent' 
                          ? `${promo.discountValue}% OFF` 
                          : `₹${promo.discountValue} OFF`
                        }
                      </span>
                    </div>
                    
                    {promo.description && (
                      <p className="text-gray-600 mb-3">{promo.description}</p>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Usage:</span>
                        <p className="font-medium">
                          {promo.usedCount || 0}
                          {promo.maxUses ? ` / ${promo.maxUses}` : ' uses'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Valid From:</span>
                        <p className="font-medium">
                          {promo.startDate 
                            ? new Date(promo.startDate).toLocaleDateString()
                            : 'No start date'
                          }
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Valid Until:</span>
                        <p className="font-medium">
                          {promo.endDate 
                            ? new Date(promo.endDate).toLocaleDateString()
                            : 'No expiry'
                          }
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Min Order:</span>
                        <p className="font-medium">
                          {promo.minOrderAmount ? `₹${promo.minOrderAmount}` : 'No minimum'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(promo)}
                      className="px-3 py-1.5 text-sm bg-blue-100 text-blue-800 hover:bg-blue-200 rounded-lg font-medium transition-colors flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(promo.id)}
                      className="px-3 py-1.5 text-sm bg-red-100 text-red-800 hover:bg-red-200 rounded-lg font-medium transition-colors flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingPromo ? 'Edit Promo Code' : 'Add New Promo Code'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Promo Code *</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
                    placeholder="e.g., WELCOME10"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Brief description"
                  />
                </div>
                
                <div className="flex items-center justify-center">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              {/* Discount Configuration */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount Type</label>
                  <select
                    value={form.discountType}
                    onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="flat">Fixed Amount (₹)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Value * {form.discountType === 'percent' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder={form.discountType === 'percent' ? '10' : '100'}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Order Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="0"
                  />
                </div>
                
                {form.discountType === 'percent' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Discount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.maxDiscountAmount}
                      onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="No limit"
                    />
                  </div>
                )}
              </div>

              {/* Usage & Validity */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Uses</label>
                  <input
                    type="number"
                    value={form.maxUses}
                    onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Unlimited"
                  />
                </div>
                
                {editingPromo && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Used Count</label>
                    <input
                      type="number"
                      value={form.usedCount}
                      onChange={(e) => setForm({ ...form, usedCount: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-gray-50"
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {editingPromo ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {editingPromo ? 'Update' : 'Create'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
    </AdminCard>
  );
}