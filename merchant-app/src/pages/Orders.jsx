import { useState, useEffect } from 'react'
import { ref, get, update } from 'firebase/database'
import { db } from '../firebase'
import { useToast } from '../components/Toast'
import { NotificationService } from '../utils/notificationService'

// Stock management functions
const updateProductStock = async (productName, quantityToDeduct) => {
  try {
    // Get all products to find the one with matching name
    const productsRef = ref(db, '/products')
    const snapshot = await get(productsRef)
    
    if (!snapshot.exists()) {
      throw new Error('No products found')
    }
    
    const products = snapshot.val()
    let targetProductId = null
    let targetProduct = null
    
    // Find product by name
    Object.entries(products).forEach(([id, product]) => {
      if (product.name === productName) {
        targetProductId = id
        targetProduct = product
      }
    })
    
    if (!targetProduct) {
      console.warn(`Product "${productName}" not found for stock update`)
      return
    }
    
    const currentStock = parseInt(targetProduct.stock) || 0
    const newStock = Math.max(0, currentStock - quantityToDeduct)
    
    // Update stock and inStock status
    const productUpdateRef = ref(db, `/products/${targetProductId}`)
    await update(productUpdateRef, {
      stock: newStock,
      inStock: newStock > 0,
      lastStockUpdate: new Date().toISOString()
    })
    
    console.log(`Stock updated for "${productName}": ${currentStock} -> ${newStock}`)
    return { oldStock: currentStock, newStock, productId: targetProductId }
  } catch (error) {
    console.error('Error updating product stock:', error)
    throw error
  }
}

const checkStockAvailability = async (orderItems) => {
  try {
    const productsRef = ref(db, '/products')
    const snapshot = await get(productsRef)
    
    if (!snapshot.exists()) {
      return { available: false, message: 'No products found' }
    }
    
    const products = snapshot.val()
    const unavailableItems = []
    
    for (const item of orderItems) {
      let productFound = false
      Object.entries(products).forEach(([id, product]) => {
        if (product.name === item.name) {
          productFound = true
          const currentStock = parseInt(product.stock) || 0
          if (!product.inStock || currentStock < item.quantity) {
            unavailableItems.push({
              name: item.name,
              requested: item.quantity,
              available: currentStock,
              inStock: product.inStock
            })
          }
        }
      })
      
      if (!productFound) {
        unavailableItems.push({
          name: item.name,
          requested: item.quantity,
          available: 0,
          inStock: false
        })
      }
    }
    
    if (unavailableItems.length > 0) {
      const message = unavailableItems.map(item => 
        `${item.name} (need: ${item.requested}, available: ${item.available})`
      ).join(', ')
      return { available: false, message, unavailableItems }
    }
    
    return { available: true }
  } catch (error) {
    console.error('Error checking stock availability:', error)
    return { available: false, message: 'Error checking stock availability' }
  }
}

const Orders = () => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [expandedOrder, setExpandedOrder] = useState(null)
  const { showToast } = useToast()

  const orderStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled']
  const statusLabels = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready: 'Ready for Pickup',
    delivered: 'Delivered',
    cancelled: 'Cancelled'
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const loadOrders = async () => {
    try {
      console.log('Loading orders for merchant:', merchant)
      const ordersRef = ref(db, '/orders')
      const snapshot = await get(ordersRef)
      const ordersData = snapshot.val() || {}
      
      console.log('All orders loaded:', Object.keys(ordersData).length)
      
      // Filter orders for current merchant
      const ordersList = Object.entries(ordersData)
        .filter(([_, order]) => {
          const matches = order.merchantId === merchant?.id || 
                         order.merchant?.id === merchant?.id ||
                         order.merchant === merchant?.id
          if (matches) {
            console.log('Found merchant order:', order)
          }
          return matches
        })
        .map(([id, order]) => ({ id, ...order }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      
      console.log('Merchant orders found:', ordersList.length)
      setOrders(ordersList)
    } catch (error) {
      console.error('Error loading orders:', error)
      showToast('Failed to load orders', 'error')
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const orderRef = ref(db, `/orders/${orderId}`)
      const currentOrder = orders.find(order => order.id === orderId)
      
      // Check stock availability before confirming order
      if (newStatus === 'confirmed' && currentOrder?.items) {
        const stockCheck = await checkStockAvailability(currentOrder.items)
        if (!stockCheck.available) {
          showToast(`Cannot confirm order: ${stockCheck.message}`, 'error')
          return
        }
      }
      
      await update(orderRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      })

      // Update stock when order is confirmed
      if (newStatus === 'confirmed' && currentOrder?.items) {
        try {
          const stockUpdates = []
          for (const item of currentOrder.items) {
            const result = await updateProductStock(item.name, item.quantity)
            if (result) {
              stockUpdates.push({
                product: item.name,
                quantity: item.quantity,
                oldStock: result.oldStock,
                newStock: result.newStock
              })
            }
          }
          
          if (stockUpdates.length > 0) {
            console.log('Stock updates completed:', stockUpdates)
            
            // Check if any products went out of stock
            const outOfStockItems = stockUpdates.filter(update => update.newStock === 0)
            if (outOfStockItems.length > 0) {
              const outOfStockNames = outOfStockItems.map(item => item.product).join(', ')
              showToast(`Order confirmed. Note: ${outOfStockNames} now out of stock`, 'warning')
            }
          }
        } catch (stockError) {
          console.error('Stock update failed:', stockError)
          showToast('Order confirmed but stock update failed. Please check inventory manually.', 'warning')
        }
      }

      setOrders(orders.map(order => 
        order.id === orderId 
          ? { ...order, status: newStatus, updatedAt: new Date().toISOString() }
          : order
      ))

      // Trigger notifications based on status change
      if (currentOrder) {
        // When order is ready, notify drivers
        if (newStatus === 'ready') {
          await NotificationService.notifyDriversOrderReady({
            id: currentOrder.id,
            total: currentOrder.total,
            storeName: currentOrder.storeName,
            merchantId: currentOrder.merchantId
          })
        }

        // Notify customer of status changes
        if (currentOrder.customer?.phone) {
          const statusMessages = {
            confirmed: 'Your order has been confirmed and is being prepared',
            preparing: 'Your order is being prepared',
            ready: 'Your order is ready for pickup/delivery',
            delivered: 'Your order has been delivered. Thank you!'
          }
          
          if (statusMessages[newStatus]) {
            await NotificationService.notifyCustomerOrderStatus(
              currentOrder.customer.phone,
              orderId,
              newStatus,
              statusMessages[newStatus]
            )
          }
        }
      }

      showToast(`Order ${statusLabels[newStatus].toLowerCase()}`, 'success')
    } catch (error) {
      console.error('Error updating order status:', error)
      showToast('Failed to update order status', 'error')
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'preparing': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'ready': return 'bg-green-100 text-green-800 border-green-200'
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount || 0)
  }

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true
    return order.status === filter
  })

  const getNextStatus = (currentStatus) => {
    const currentIndex = orderStatuses.indexOf(currentStatus)
    if (currentIndex === -1 || currentIndex >= orderStatuses.length - 2) return null
    return orderStatuses[currentIndex + 1]
  }

  const canAdvanceStatus = (status) => {
    return status !== 'delivered' && status !== 'cancelled'
  }

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
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadOrders}
            className="p-2 text-gray-600 hover:text-gray-900 touch-target"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors touch-target ${
            filter === 'all'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors touch-target ${
            filter === 'pending'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Pending
        </button>
        <button
          onClick={() => setFilter('preparing')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors touch-target ${
            filter === 'preparing'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Active
        </button>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="card p-8 text-center">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500">No orders found</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div key={order.id} className="card overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div>
                      <p className="font-semibold text-gray-900">
                        Order #{order.id?.substring(0, 8)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {new Date(order.createdAt).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(order.status)}`}>
                      {statusLabels[order.status]}
                    </span>
                    <button
                      onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 touch-target"
                    >
                      <svg
                        className={`w-5 h-5 transform transition-transform ${
                          expandedOrder === order.id ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900">{order.address?.name}</p>
                    <p className="text-sm text-gray-600">{order.address?.mobile}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(order.total)}</p>
                    <p className="text-sm text-gray-600">{order.items?.length || 0} items</p>
                  </div>
                </div>

                {/* Action Buttons */}
                {canAdvanceStatus(order.status) && (
                  <div className="flex space-x-2 mt-3">
                    {getNextStatus(order.status) && (
                      <button
                        onClick={() => updateOrderStatus(order.id, getNextStatus(order.status))}
                        className="btn-primary flex-1 py-2"
                      >
                        Mark as {statusLabels[getNextStatus(order.status)]}
                      </button>
                    )}
                    {order.status === 'pending' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'cancelled')}
                        className="btn-secondary py-2 px-4"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Expanded Details */}
              {expandedOrder === order.id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <div className="space-y-4">
                    {/* Customer Details */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Customer Details</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p><span className="font-medium">Name:</span> {order.address?.name}</p>
                        <p><span className="font-medium">Mobile:</span> {order.address?.mobile}</p>
                        <p><span className="font-medium">Address:</span> {order.address?.address}, {order.address?.locality}</p>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Order Items</h4>
                      <div className="space-y-2">
                        {order.items?.map((item, index) => (
                          <div key={index} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{item.name}</p>
                              <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-gray-900">{formatCurrency(item.price * item.quantity)}</p>
                              <p className="text-sm text-gray-600">{formatCurrency(item.price)} each</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Order Summary */}
                    <div className="border-t border-gray-200 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">Total Amount</span>
                        <span className="font-bold text-lg text-gray-900">{formatCurrency(order.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Orders