import React, { useState, useEffect } from 'react';
import { ref, onValue, update, push, remove } from 'firebase/database';
import { db } from '../../firebase';
import { showToast } from '../../components/Toast';

export default function DriversAdmin() {
  const [drivers, setDrivers] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    id: '',
    name: '',
    phone: '',
    email: '',
    vehicle: '',
    licenseNumber: '',
    status: 'available',
    password: 'delivery123'
  });

  useEffect(() => {
    // Load drivers from Firebase
    const driversRef = ref(db, '/drivers');
    onValue(driversRef, (snapshot) => {
      setDrivers(snapshot.val() || {});
      setLoading(false);
    });
  }, []);

  const resetForm = () => {
    setForm({
      id: '',
      name: '',
      phone: '',
      email: '',
      vehicle: '',
      licenseNumber: '',
      status: 'available',
      password: 'delivery123'
    });
    setEditingDriver(null);
  };

  const generateId = () => {
    const existingIds = Object.values(drivers).map(d => d.id).filter(Boolean);
    let newId = 'DEL001';
    let counter = 1;
    
    while (existingIds.includes(newId)) {
      counter++;
      newId = `DEL${counter.toString().padStart(3, '0')}`;
    }
    
    return newId;
  };

  const handleSave = async () => {
    if (!form.name || !form.phone) {
      showToast('Please fill required fields', 'error');
      return;
    }

    try {
      const driverData = {
        ...form,
        updatedAt: new Date().toISOString()
      };

      if (editingDriver) {
        await update(ref(db, `/drivers/${editingDriver}`), driverData);
        showToast('Driver updated successfully', 'success');
      } else {
        driverData.id = form.id || generateId();
        driverData.createdAt = new Date().toISOString();
        await push(ref(db, '/drivers'), driverData);
        showToast('Driver added successfully', 'success');
      }

      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving driver:', error);
      showToast('Failed to save driver', 'error');
    }
  };

  const handleEdit = (id, driver) => {
    setEditingDriver(id);
    setForm(driver);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this driver?')) return;

    try {
      await remove(ref(db, `/drivers/${id}`));
      showToast('Driver deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting driver:', error);
      showToast('Failed to delete driver', 'error');
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await update(ref(db, `/drivers/${id}`), { 
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      showToast('Driver status updated', 'success');
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Failed to update status', 'error');
    }
  };

  // Filter drivers
  const filteredDrivers = Object.entries(drivers).filter(([id, driver]) => {
    return driver.name?.toLowerCase().includes(search.toLowerCase()) ||
           driver.phone?.includes(search) ||
           driver.id?.toLowerCase().includes(search.toLowerCase());
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'busy': return 'bg-yellow-100 text-yellow-800';
      case 'offline': return 'bg-gray-100 text-gray-800';
      case 'disabled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleDriverStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'disabled' ? 'available' : 'disabled';
    try {
      await update(ref(db, `/drivers/${id}`), { 
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      showToast(`Driver ${newStatus === 'disabled' ? 'disabled' : 'enabled'} successfully`, 'success');
    } catch (error) {
      console.error('Error updating driver status:', error);
      showToast('Failed to update driver status', 'error');
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Driver Management</h1>
          <p className="text-gray-600">Manage delivery partners and their status</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setForm(prev => ({ ...prev, id: generateId() }));
            setShowModal(true);
          }}
          className="btn-primary"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Driver
        </button>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <input
          type="text"
          placeholder="Search drivers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Drivers List */}
      {filteredDrivers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No drivers found</h3>
          <p className="text-gray-500 mb-4">Get started by adding your first driver</p>
          <button
            onClick={() => {
              resetForm();
              setForm(prev => ({ ...prev, id: generateId() }));
              setShowModal(true);
            }}
            className="btn-primary"
          >
            Add Driver
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredDrivers.map(([id, driver]) => (
                  <tr key={id} className={`hover:bg-gray-50 ${driver.status === 'disabled' ? 'opacity-60 bg-gray-25' : ''}`}>
                    <td className="px-6 py-4">
                      <div>
                        <div className={`font-medium ${driver.status === 'disabled' ? 'text-gray-500' : 'text-gray-900'}`}>
                          {driver.name}
                          {driver.status === 'disabled' && (
                            <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded">DISABLED</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">ID: {driver.id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm text-gray-900">{driver.phone}</div>
                        <div className="text-sm text-gray-500">{driver.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm text-gray-900">{driver.vehicle}</div>
                        <div className="text-sm text-gray-500">{driver.licenseNumber}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={driver.status}
                        onChange={(e) => updateStatus(id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full border-none ${getStatusColor(driver.status)}`}
                        disabled={driver.status === 'disabled'}
                      >
                        <option value="available">Available</option>
                        <option value="busy">Busy</option>
                        <option value="offline">Offline</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => toggleDriverStatus(id, driver.status)}
                          className={`text-sm font-medium px-3 py-1 rounded ${
                            driver.status === 'disabled' 
                              ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                              : 'bg-red-100 text-red-600 hover:bg-red-200'
                          }`}
                        >
                          {driver.status === 'disabled' ? 'Enable' : 'Disable'}
                        </button>
                        <button
                          onClick={() => handleEdit(id, driver)}
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold">
                  {editingDriver ? 'Edit Driver' : 'Add New Driver'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Driver ID *</label>
                  <input
                    type="text"
                    value={form.id}
                    onChange={(e) => setForm({...form, id: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                  <select
                    value={form.vehicle}
                    onChange={(e) => setForm({...form, vehicle: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Vehicle</option>
                    <option value="Bike">Bike</option>
                    <option value="Car">Car</option>
                    <option value="Van">Van</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                  <input
                    type="text"
                    value={form.licenseNumber}
                    onChange={(e) => setForm({...form, licenseNumber: e.target.value})}
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
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="offline">Offline</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm({...form, password: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  {editingDriver ? 'Update Driver' : 'Add Driver'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}