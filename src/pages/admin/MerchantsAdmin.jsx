import React, { useState, useEffect } from 'react';
import { ref, onValue, update, push, remove } from 'firebase/database';
import { db } from '../../firebase';
import { showToast } from '../../components/Toast';
import AdminCard from './AdminCard';

export default function MerchantsAdmin() {
  const [merchants, setMerchants] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState(null);
  const [search, setSearch] = useState('');

  const generateSecurePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const [form, setForm] = useState({
    id: '',
    name: '',
    storeName: '',
    phone: '',
    email: '',
    address: '',
    category: '',
    permissions: {
      products: true,
      categories: true,
      orders: false,
      analytics: false,
      earnings: true
    },
    status: 'active',
    password: generateSecurePassword()
  });

  useEffect(() => {
    // Load merchants from Firebase
    const merchantsRef = ref(db, '/merchants');
    onValue(merchantsRef, (snapshot) => {
      setMerchants(snapshot.val() || {});
      setLoading(false);
    });
  }, []);

  const resetForm = () => {
    setForm({
      id: '',
      name: '',
      storeName: '',
      phone: '',
      email: '',
      address: '',
      category: '',
      permissions: {
        products: true,
        categories: true,
        orders: false,
        analytics: false,
        earnings: true
      },
      status: 'active',
      password: generateSecurePassword()
    });
    setEditingMerchant(null);
  };

  const generateId = () => {
    const existingIds = Object.values(merchants).map(m => m.id).filter(Boolean);
    let newId = 'MER001';
    let counter = 1;
    
    while (existingIds.includes(newId)) {
      counter++;
      newId = `MER${counter.toString().padStart(3, '0')}`;
    }
    
    return newId;
  };

  const handleSave = async () => {
    if (!form.name || !form.storeName || !form.phone) {
      showToast('Please fill required fields', 'error');
      return;
    }

    try {
      const merchantData = {
        ...form,
        updatedAt: new Date().toISOString()
      };

      if (editingMerchant) {
        await update(ref(db, `/merchants/${editingMerchant}`), merchantData);
        showToast('Merchant updated successfully', 'success');
      } else {
        merchantData.id = form.id || generateId();
        merchantData.createdAt = new Date().toISOString();
        await push(ref(db, '/merchants'), merchantData);
        showToast('Merchant added successfully', 'success');
      }

      if (!editingMerchant) {
        resetForm();
      }
    } catch (error) {
      console.error('Error saving merchant:', error);
      showToast('Failed to save merchant', 'error');
    }
  };

  const handleEdit = (id, merchant) => {
    setEditingMerchant(id);
    // Ensure form has all required fields with proper defaults
    setForm({
      id: merchant.id || '',
      name: merchant.name || '',
      storeName: merchant.storeName || '',
      phone: merchant.phone || '',
      email: merchant.email || '',
      address: merchant.address || '',
      category: merchant.category || '',
      permissions: {
        products: merchant.permissions?.products || false,
        categories: merchant.permissions?.categories || false,
        orders: merchant.permissions?.orders || false,
        analytics: merchant.permissions?.analytics || false,
        earnings: merchant.permissions?.earnings || true
      },
      status: merchant.status || 'active',
      password: merchant.password || generateSecurePassword()
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this merchant?')) return;

    try {
      await remove(ref(db, `/merchants/${id}`));
      showToast('Merchant deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting merchant:', error);
      showToast('Failed to delete merchant', 'error');
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await update(ref(db, `/merchants/${id}`), { 
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      showToast('Merchant status updated', 'success');
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Failed to update status', 'error');
    }
  };

  // Filter merchants
  const filteredMerchants = Object.entries(merchants).filter(([id, merchant]) => {
    return merchant.name?.toLowerCase().includes(search.toLowerCase()) ||
           merchant.storeName?.toLowerCase().includes(search.toLowerCase()) ||
           merchant.phone?.includes(search) ||
           merchant.id?.toLowerCase().includes(search.toLowerCase());
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AdminCard
      title="Merchant Management"
      subtitle="Manage store owners and their permissions"
    >
      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Merchants List */}
        <div className="lg:col-span-1">
          {/* Header with Search and Add Button */}
          <div className="flex justify-between items-center mb-4">
            <div className="max-w-md flex-1">
              <input
                type="text"
                placeholder="Search merchants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => {
                resetForm();
                setForm(prev => ({ ...prev, id: generateId() }));
              }}
              className="ml-4 btn-primary"
            >
              Add Merchant
            </button>
          </div>

      {/* Merchants List */}
      {filteredMerchants.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200 mt-4">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No merchants found</h3>
          <p className="text-gray-500 mb-4">Get started by adding your first merchant</p>
          <button
            onClick={() => {
              resetForm();
              setForm(prev => ({ ...prev, id: generateId() }));
            }}
            className="btn-primary"
          >
            Add Merchant
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mt-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Merchant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredMerchants.map(([id, merchant]) => (
                  <tr key={id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{merchant.name}</div>
                        <div className="text-sm text-gray-500">ID: {merchant.id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm text-gray-900">{merchant.storeName}</div>
                        <div className="text-sm text-gray-500">{merchant.category}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm text-gray-900">{merchant.phone}</div>
                        <div className="text-sm text-gray-500">{merchant.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {merchant.permissions?.products && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Products</span>
                        )}
                        {merchant.permissions?.categories && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Categories</span>
                        )}
                        {merchant.permissions?.orders && (
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Orders</span>
                        )}
                        {merchant.permissions?.analytics && (
                          <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">Analytics</span>
                        )}
                        {merchant.permissions?.earnings && (
                          <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded">Earnings</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={merchant.status}
                        onChange={(e) => updateStatus(id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full border-none ${getStatusColor(merchant.status)}`}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="pending">Pending</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(id, merchant)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </div>

        {/* Right Column - Add/Edit Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold">
                {editingMerchant ? 'Edit Merchant' : 'Add New Merchant'}
              </h2>
              <button
                onClick={() => resetForm()}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Merchant ID *</label>
                <input
                  type="text"
                  value={form.id}
                  onChange={(e) => setForm({...form, id: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({...form, name: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store Name *</label>
                <input
                  type="text"
                  value={form.storeName}
                  onChange={(e) => setForm({...form, storeName: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({...form, phone: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({...form, email: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store Category</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({...form, category: e.target.value})}
                  placeholder="e.g., Grocery, Electronics"
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({...form, address: e.target.value})}
                  rows={2}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({...form, status: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm({...form, password: e.target.value})}
                    className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({...form, password: generateSecurePassword()})}
                    className="px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Generate
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Share this password with the merchant for login</p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-3">Permissions</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={form.permissions.products}
                      onChange={(e) => setForm({
                        ...form,
                        permissions: { ...form.permissions, products: e.target.checked }
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Manage Products</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={form.permissions.categories}
                      onChange={(e) => setForm({
                        ...form,
                        permissions: { ...form.permissions, categories: e.target.checked }
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Manage Categories</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={form.permissions.orders}
                      onChange={(e) => setForm({
                        ...form,
                        permissions: { ...form.permissions, orders: e.target.checked }
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">View Orders</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={form.permissions.analytics}
                      onChange={(e) => setForm({
                        ...form,
                        permissions: { ...form.permissions, analytics: e.target.checked }
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">View Analytics</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={form.permissions.earnings}
                      onChange={(e) => setForm({
                        ...form,
                        permissions: { ...form.permissions, earnings: e.target.checked }
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">View Earnings Dashboard</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button 
                onClick={() => resetForm()}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Clear
              </button>
              <button 
                onClick={handleSave} 
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {editingMerchant ? 'Update Merchant' : 'Add Merchant'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminCard>
  );
}