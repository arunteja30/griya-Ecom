import { useState, useEffect } from 'react'
import { ref, get, set, push, remove } from 'firebase/database'
import { db } from '../firebase'
import { useToast } from '../components/Toast'
import ImagePicker from '../components/ImagePicker'

const Products = ({ merchant }) => {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [showCategoryImagePicker, setShowCategoryImagePicker] = useState(false)
  const [newCategoryData, setNewCategoryData] = useState({
    name: '',
    slug: '',
    image: '',
    description: '',
    sortOrder: 0,
    tags: []
  })
  const { showToast } = useToast()

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    originalPrice: '',
    discount: 0,
    category: '',
    categoryId: '',
    stock: '',
    inStock: true,
    unit: 'piece',
    unitValue: '',
    imageUrl: '',
    images: [],
    tags: [],
    slug: '',
    isBestseller: false,
    rating: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  // Debug: Log form data changes
  useEffect(() => {
    if (editingProduct) {
      console.log('Form data updated for editing:', formData)
    }
  }, [formData, editingProduct])

  const loadData = async () => {
    try {
      // Load products from merchant-specific path
      const merchantId = merchant?.id || 'unknown'
      const productsRef = ref(db, `/merchantProducts/${merchantId}`)
      const productsSnapshot = await get(productsRef)
      const productsData = productsSnapshot.val() || {}
      
      const productsList = Object.entries(productsData).map(([id, product]) => ({
        id,
        ...product
      }))
      
      setProducts(productsList)

      // Load categories
      const categoriesRef = ref(db, '/categories')
      const categoriesSnapshot = await get(categoriesRef)
      const categoriesData = categoriesSnapshot.val() || {}
      
      const categoriesList = Object.values(categoriesData)
      setCategories(categoriesList)

    } catch (error) {
      console.error('Error loading data:', error)
      showToast('Failed to load products', 'error')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      originalPrice: '',
      discount: 0,
      category: '',
      categoryId: '',
      stock: '',
      inStock: true,
      unit: 'piece',
      unitValue: '',
      imageUrl: '',
      images: [],
      tags: [],
      slug: '',
      isBestseller: false,
      rating: '',
      variants: {}
    })
    setEditingProduct(null)
  }

  const createCategory = async () => {
    if (!newCategoryData.name.trim()) {
      showToast('Category name is required', 'error')
      return
    }

    try {
      const computedSlug = newCategoryData.slug && newCategoryData.slug.trim() !== '' 
        ? newCategoryData.slug 
        : newCategoryData.name.toLowerCase().replace(/\s+/g, '-')
      
      const payload = { 
        name: newCategoryData.name.trim(), 
        slug: computedSlug,
        createdAt: new Date().toISOString(),
        createdBy: merchant?.id || 'merchant'
      }
      
      if (newCategoryData.image) payload.image = newCategoryData.image
      if (newCategoryData.description) payload.description = newCategoryData.description
      if (newCategoryData.sortOrder !== undefined && newCategoryData.sortOrder !== null) {
        payload.sortOrder = Number(newCategoryData.sortOrder)
      }
      if (newCategoryData.tags && newCategoryData.tags.length) {
        payload.tags = newCategoryData.tags
      }

      const categoriesRef = ref(db, '/categories')
      const newCategoryRef = push(categoriesRef)
      await set(newCategoryRef, payload)

      setCategories([...categories, {
        id: newCategoryRef.key,
        ...payload
      }])

      setNewCategoryData({
        name: '',
        slug: '',
        image: '',
        description: '',
        sortOrder: 0,
        tags: []
      })
      setShowNewCategoryModal(false)
      showToast('Category created successfully', 'success')
    } catch (error) {
      console.error('Error creating category:', error)
      showToast('Failed to create category', 'error')
    }
  }

  const openAddModal = () => {
    resetForm()
    setShowAddModal(true)
  }

  const openEditModal = (product) => {
    const newFormData = {
      name: product.name || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      originalPrice: product.originalPrice?.toString() || '',
      discount: product.discount || 0,
      category: product.category || '',
      categoryId: product.categoryId || '',
      stock: product.stock?.toString() || '',
      inStock: product.inStock !== false,
      unit: product.unit || 'piece',
      unitValue: product.unitValue || '',
      imageUrl: product.imageUrl || (Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : ''),
      images: Array.isArray(product.images) ? product.images : [],
      tags: Array.isArray(product.tags) ? product.tags : [],
      slug: product.slug || '',
      isBestseller: product.isBestseller || false,
      rating: product.rating?.toString() || '',
      variants: product.variants || {}
    }
    
    setEditingProduct(product)
    
    // Use setTimeout to ensure state is set before opening modal
    setTimeout(() => {
      setFormData(newFormData)
      setShowAddModal(true)
    }, 10)
  }

  const openCopyModal = (product) => {
    console.log('Opening copy modal for product:', product)
    
    const newFormData = {
      name: `${product.name} (Copy)`,
      description: product.description || '',
      price: product.price?.toString() || '',
      originalPrice: product.originalPrice?.toString() || '',
      discount: product.discount || 0,
      category: product.category || '',
      categoryId: product.categoryId || '',
      stock: product.stock?.toString() || '',
      inStock: product.inStock !== false,
      unit: product.unit || 'piece',
      unitValue: product.unitValue || '',
      imageUrl: product.imageUrl || (Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : ''),
      images: Array.isArray(product.images) ? product.images : [],
      tags: Array.isArray(product.tags) ? product.tags : [],
      slug: `${product.slug}-copy` || '',
      isBestseller: false, // Reset bestseller for copy
      rating: product.rating?.toString() || '',
      variants: product.variants || {}
    }
    
    console.log('Setting copy form data:', newFormData)
    setEditingProduct(null) // Clear editing product for new product
    
    setTimeout(() => {
      setFormData(newFormData)
      setShowAddModal(true)
    }, 10)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.name || !formData.price || !formData.category) {
      showToast('Please fill in required fields', 'error')
      return
    }

    try {
      // Calculate discount if both prices are provided
      let discount = 0
      if (formData.originalPrice && formData.price) {
        const original = parseFloat(formData.originalPrice)
        const current = parseFloat(formData.price)
        if (original > current) {
          discount = Math.round(((original - current) / original) * 100)
        }
      }

      const productData = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : null,
        discount,
        category: formData.category,
        categoryId: formData.categoryId,
        stock: parseInt(formData.stock) || 0,
        inStock: formData.inStock,
        unit: formData.unit,
        unitValue: formData.unitValue,
        imageUrl: formData.imageUrl,
        images: formData.imageUrl ? [formData.imageUrl] : [],
        tags: Array.isArray(formData.tags) ? formData.tags : [],
        slug: formData.slug || formData.name.toLowerCase().replace(/\\s+/g, '-'),
        isBestseller: formData.isBestseller || false,
        rating: formData.rating ? parseFloat(formData.rating) : null,
        variants: formData.variants || {},
        updatedAt: new Date().toISOString(),
        merchantId: merchant?.id || 'unknown'
      }

      if (editingProduct) {
        // Update existing product
        const merchantId = merchant?.id || 'unknown'
        const productRef = ref(db, `/merchantProducts/${merchantId}/${editingProduct.id}`)
        await set(productRef, productData)
        
        setProducts(products.map(p => 
          p.id === editingProduct.id ? { ...productData, id: editingProduct.id } : p
        ))
        
        showToast('Product updated successfully', 'success')
      } else {
        // Add new product
        const merchantId = merchant?.id || 'unknown'
        const productsRef = ref(db, `/merchantProducts/${merchantId}`)
        const newProductRef = push(productsRef)
        await set(newProductRef, {
          ...productData,
          createdAt: new Date().toISOString()
        })
        
        setProducts([...products, { ...productData, id: newProductRef.key, createdAt: new Date().toISOString() }])
        showToast('Product added successfully', 'success')
      }

      setShowAddModal(false)
      resetForm()
    } catch (error) {
      console.error('Error saving product:', error)
      showToast('Failed to save product', 'error')
    }
  }

  const deleteProduct = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      const merchantId = merchant?.id || 'unknown'
      const productRef = ref(db, `/merchantProducts/${merchantId}/${productId}`)
      await remove(productRef)
      
      setProducts(products.filter(p => p.id !== productId))
      showToast('Product deleted successfully', 'success')
    } catch (error) {
      console.error('Error deleting product:', error)
      showToast('Failed to delete product', 'error')
    }
  }

  const toggleStock = async (product) => {
    try {
      const productRef = ref(db, `/products/${product.id}`)
      await set(productRef, {
        ...product,
        inStock: !product.inStock,
        updatedAt: new Date().toISOString()
      })
      
      setProducts(products.map(p => 
        p.id === product.id ? { ...p, inStock: !p.inStock } : p
      ))
      
      showToast(`Product marked as ${!product.inStock ? 'in stock' : 'out of stock'}`, 'success')
    } catch (error) {
      console.error('Error updating stock status:', error)
      showToast('Failed to update stock status', 'error')
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount || 0)
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = filterCategory === 'all' || product.category === filterCategory
    
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <button
          onClick={openAddModal}
          className="btn-primary flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Product</span>
        </button>
      </div>

      {/* Stock Overview */}
      {(() => {
        const totalProducts = filteredProducts.length
        const inStockProducts = filteredProducts.filter(p => p.inStock && p.stock > 0).length
        const outOfStockProducts = filteredProducts.filter(p => !p.inStock || p.stock === 0).length
        const lowStockProducts = filteredProducts.filter(p => p.stock > 0 && p.stock <= 5).length
        
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{totalProducts}</div>
                <div className="text-sm text-gray-600">Total Products</div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{inStockProducts}</div>
                <div className="text-sm text-gray-600">In Stock</div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{lowStockProducts}</div>
                <div className="text-sm text-gray-600">Low Stock (≤5)</div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{outOfStockProducts}</div>
                <div className="text-sm text-gray-600">Out of Stock</div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Search and Filter */}
      <div className="space-y-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Categories</option>
          {categories.map((category) => (
            <option key={category.name} value={category.name}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full card p-8 text-center">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-gray-500">No products found</p>
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="card overflow-hidden">
              {product.imageUrl && (
                <div className="aspect-video bg-gray-100">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.src = '';
                      e.target.removeAttribute('src');
                    }}
                  />
                </div>
              )}
              
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{product.name}</h3>
                    {product.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{product.description}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-1 ml-2">
                    <button
                      onClick={() => openEditModal(product)}
                      className="p-2 text-gray-400 hover:text-blue-600 touch-target"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => openCopyModal(product)}
                      className="p-2 text-gray-400 hover:text-green-600 touch-target"
                      title="Copy Product"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="p-2 text-gray-400 hover:text-red-600 touch-target"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-lg text-gray-900">{formatCurrency(product.price)}</span>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <span className="text-sm text-gray-500 line-through">{formatCurrency(product.originalPrice)}</span>
                    )}
                  </div>
                  <span className="text-sm text-gray-600">per {product.unit}</span>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Stock:</span>
                    <span className={`font-semibold text-sm px-2 py-1 rounded-full ${
                      product.stock === 0 
                        ? 'bg-red-100 text-red-800' 
                        : product.stock <= 5 
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {product.stock || 0}
                      {product.stock <= 5 && product.stock > 0 && (
                        <span className="ml-1 text-xs">⚠️</span>
                      )}
                    </span>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    product.inStock && product.stock > 0
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {product.inStock && product.stock > 0 ? 'Available' : 'Out of Stock'}
                  </span>
                </div>

                <button
                  onClick={() => toggleStock(product)}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors touch-target ${
                    product.inStock
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  Mark as {product.inStock ? 'Out of Stock' : 'In Stock'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 pb-safe pb-16">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    resetForm()
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 touch-target"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Original Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.originalPrice}
                      onChange={(e) => setFormData({...formData, originalPrice: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Category *
                    </label>
                    {merchant?.permissions?.categories && (
                      <button
                        type="button"
                        onClick={() => setShowNewCategoryModal(true)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        + Add Category
                      </button>
                    )}
                  </div>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map((category) => (
                      <option key={category.name} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stock Quantity
                    </label>
                    <input
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({...formData, stock: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    >
                      <option value="piece">Piece</option>
                      <option value="kg">Kilogram</option>
                      <option value="gm">Gram</option>
                      <option value="liter">Liter</option>
                      <option value="ml">Milliliter</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Image URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      placeholder="https://example.com/image.jpg"
                    />
                    <button
                      type="button"
                      onClick={() => setShowImagePicker(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Pick from Gallery
                    </button>
                  </div>
                  {formData.imageUrl && (
                    <div className="mt-2">
                      <img 
                        src={formData.imageUrl} 
                        alt="Preview" 
                        className="w-20 h-20 object-cover rounded border"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.src = '';
                          e.target.removeAttribute('src');
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit Value (e.g., 250g, 1L)
                    </label>
                    <input
                      type="text"
                      value={formData.unitValue}
                      onChange={(e) => setFormData({...formData, unitValue: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      placeholder="e.g., 250g, 1L, 500ml"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Slug
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({...formData, slug: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      placeholder="product-name-slug"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={Array.isArray(formData.tags) ? formData.tags.join(', ') : ''}
                    onChange={(e) => {
                      const tags = e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                      setFormData({...formData, tags})
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    placeholder="organic, fresh, bestseller"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="inStock"
                    checked={formData.inStock}
                    onChange={(e) => setFormData({...formData, inStock: e.target.checked})}
                    className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 focus:ring-2"
                  />
                  <label htmlFor="inStock" className="ml-2 text-sm text-gray-700">
                    In Stock
                  </label>
                </div>

                {/* Variants Section */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">Product Variants</label>
                    <button
                      type="button"
                      onClick={() => {
                        const id = `v-${Date.now()}`
                        setFormData({
                          ...formData,
                          variants: {
                            ...(formData.variants || {}),
                            [id]: { id, label: '', unit: '', price: '' }
                          }
                        })
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + Add Variant
                    </button>
                  </div>
                  
                  {Object.entries(formData.variants || {}).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(formData.variants || {}).map(([vk, v]) => (
                        <div key={vk} className="grid grid-cols-1 md:grid-cols-4 gap-2 p-3 bg-gray-50 rounded-lg">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
                            <input
                              type="text"
                              value={v.label || ''}
                              onChange={(e) => {
                                setFormData({
                                  ...formData,
                                  variants: {
                                    ...(formData.variants || {}),
                                    [vk]: { ...(formData.variants[vk] || {}), label: e.target.value }
                                  }
                                })
                              }}
                              placeholder="e.g. 250g, Large"
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                            <input
                              type="text"
                              value={v.unit || ''}
                              onChange={(e) => {
                                setFormData({
                                  ...formData,
                                  variants: {
                                    ...(formData.variants || {}),
                                    [vk]: { ...(formData.variants[vk] || {}), unit: e.target.value }
                                  }
                                })
                              }}
                              placeholder="e.g. 250g, 1L"
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Price</label>
                            <input
                              type="number"
                              step="0.01"
                              value={v.price || ''}
                              onChange={(e) => {
                                setFormData({
                                  ...formData,
                                  variants: {
                                    ...(formData.variants || {}),
                                    [vk]: { ...(formData.variants[vk] || {}), price: e.target.value }
                                  }
                                })
                              }}
                              placeholder="Price"
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                            />
                          </div>
                          
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => {
                                const newVariants = { ...(formData.variants || {}) }
                                delete newVariants[vk]
                                setFormData({ ...formData, variants: newVariants })
                              }}
                              className="px-2 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-4">
                      No variants added. Click "Add Variant" to create product variations.
                    </div>
                  )}
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1"
                  >
                    {editingProduct ? 'Update' : 'Add'} Product
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 pb-safe pb-16">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-6 border-b border-gray-200 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Add New Category</h3>
                <button
                  onClick={() => {
                    setShowNewCategoryModal(false)
                    setNewCategoryData({
                      name: '',
                      slug: '',
                      image: '',
                      description: '',
                      sortOrder: 0,
                      tags: []
                    })
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={newCategoryData.name}
                  onChange={(e) => setNewCategoryData({...newCategoryData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="Enter category name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  value={newCategoryData.slug}
                  onChange={(e) => setNewCategoryData({...newCategoryData, slug: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="category-slug (optional, auto-generated from name)"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={newCategoryData.image}
                    onChange={(e) => setNewCategoryData({...newCategoryData, image: e.target.value})}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    placeholder="https://example.com/image.jpg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCategoryImagePicker(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Pick from Gallery
                  </button>
                </div>
                {newCategoryData.image && (
                  <div className="mt-2">
                    <img 
                      src={newCategoryData.image} 
                      alt="Preview" 
                      className="w-20 h-20 object-cover rounded border"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.src = '';
                        e.target.removeAttribute('src');
                      }}
                    />
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={newCategoryData.sortOrder}
                  onChange={(e) => setNewCategoryData({...newCategoryData, sortOrder: Number(e.target.value || 0)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={(newCategoryData.tags || []).join(', ')}
                  onChange={(e) => {
                    const tags = e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                    setNewCategoryData({...newCategoryData, tags})
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="fresh, popular, trending"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newCategoryData.description}
                  onChange={(e) => setNewCategoryData({...newCategoryData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  rows={3}
                  placeholder="Category description (optional)"
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowNewCategoryModal(false)
                    setNewCategoryData({
                      name: '',
                      slug: '',
                      image: '',
                      description: '',
                      sortOrder: 0,
                      tags: []
                    })
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createCategory}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={!newCategoryData.name.trim()}
                >
                  Create Category
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Image Pickers */}
      <ImagePicker 
        isOpen={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onSelect={(url) => setFormData({...formData, imageUrl: url})}
        selectedUrl={formData.imageUrl}
      />
      
      <ImagePicker 
        isOpen={showCategoryImagePicker}
        onClose={() => setShowCategoryImagePicker(false)}
        onSelect={(url) => setNewCategoryData({...newCategoryData, image: url})}
        selectedUrl={newCategoryData.image}
      />
    </div>
  )
}

export default Products