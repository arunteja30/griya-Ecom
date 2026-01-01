import { useState, useEffect } from 'react'
import { ref, get, update } from 'firebase/database'
import { db } from '../firebase'
import { useToast } from '../components/Toast'
import { NotificationService } from '../utils/notificationService'
import { SoundNotification } from '../utils/soundNotification'

// Stock management functions
const updateProductStock = async (productName, quantityToDeduct, merchantId) => {
  try {
    if (!merchantId) {
      throw new Error('Merchant ID not provided')
    }
    
    // Get merchant-specific products
    const productsRef = ref(db, `/merchantProducts/${merchantId}`)
    const snapshot = await get(productsRef)
    
    if (!snapshot.exists()) {
      throw new Error('No merchant products found')
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
      console.warn(`Product "${productName}" not found for merchant ${merchantId}`)
      return
    }
    
    const currentStock = parseInt(targetProduct.stock) || 0
    const newStock = Math.max(0, currentStock - quantityToDeduct)
    
    // Update stock in merchant-specific path
    const productUpdateRef = ref(db, `/merchantProducts/${merchantId}/${targetProductId}`)
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

const checkStockAvailability = async (orderItems, merchantId) => {
  try {
    if (!merchantId) {
      return { available: false, message: 'Merchant ID not provided' }
    }
    
    const productsRef = ref(db, `/merchantProducts/${merchantId}`)
    const snapshot = await get(productsRef)
    
    if (!snapshot.exists()) {
      return { available: false, message: 'No products found for this merchant' }
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

const Orders = ({ merchant }) => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all') // all | today | last7 | last30 | custom
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [expandedOrder, setExpandedOrder] = useState(null)
  const { showToast } = useToast()

  const orderStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'handed-to-driver', 'delivered', 'cancelled']
  const statusLabels = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    'ready': 'Ready for Pickup',
    'handed-to-driver': 'Handed to Driver',
    delivered: 'Delivered',
    cancelled: 'Cancelled'
  }

  useEffect(() => {
    if (merchant?.id) {
      loadOrders()
    }
  }, [merchant])

  const loadOrders = async () => {
    try {
      console.log('Loading orders for merchant:', merchant)
      
      if (!merchant?.id) {
        console.error('No merchant ID found')
        showToast('Merchant not found', 'error')
        return
      }
      
      // Load orders from merchant-specific path
      const merchantOrdersRef = ref(db, `/merchantOrders/${merchant.id}`)
      const snapshot = await get(merchantOrdersRef)
      const ordersData = snapshot.val() || {}
      
      console.log('Merchant orders loaded:', Object.keys(ordersData).length)
      
      // Convert to array and sort by creation date
      const ordersList = Object.entries(ordersData)
        .map(([id, order]) => ({ id, ...order }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      
      console.log('Final orders list:', ordersList.length)
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
      if (!merchant?.id) {
        showToast('Merchant not found', 'error')
        return
      }
      
      // Update order in merchant-specific path
      const orderRef = ref(db, `/merchantOrders/${merchant.id}/${orderId}`)
      const currentOrder = orders.find(order => order.id === orderId)
      
      // Check stock availability before confirming order
      if (newStatus === 'confirmed' && currentOrder?.items) {
        const stockCheck = await checkStockAvailability(currentOrder.items, merchant.id)
        if (!stockCheck.available) {
          showToast(`Cannot confirm order: ${stockCheck.message}`, 'error')
          return
        }
      }
      
      await update(orderRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      })

      // Play success sound for order confirmation
      if (newStatus === 'confirmed') {
        SoundNotification.playSuccess();
      } else if (newStatus === 'delivered') {
        SoundNotification.playSuccess();
      } else if (newStatus === 'cancelled') {
        SoundNotification.playNotificationSound('warning');
      }

      // Update stock when order is confirmed
      if (newStatus === 'confirmed' && currentOrder?.items) {
        try {
          const stockUpdates = []
          for (const item of currentOrder.items) {
            const result = await updateProductStock(item.name, item.quantity, merchant.id)
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

      // Send customer notifications for all status changes
      if (currentOrder && (currentOrder.customerPhone || currentOrder.address?.phone)) {
        const customerPhone = currentOrder.customerPhone || currentOrder.address?.phone
        const statusMessages = {
          confirmed: `Your order #${currentOrder.id} has been confirmed and is being prepared.`,
          preparing: `Your order #${currentOrder.id} is now being prepared. We'll notify you when it's ready!`,
          ready: `Great news! Your order #${currentOrder.id} is ready for pickup/delivery.`,
          'handed-to-driver': `Your order #${currentOrder.id} has been handed to the delivery driver and is on its way to you!`,
          delivered: `Your order #${currentOrder.id} has been delivered successfully. Thank you for your order!`,
          cancelled: `We're sorry, but your order #${currentOrder.id} has been cancelled. Please contact us for details.`
        }

        const statusMessage = statusMessages[newStatus]
        if (statusMessage) {
          await NotificationService.notifyCustomerOrderStatus(
            customerPhone,
            currentOrder.id,
            newStatus,
            statusMessage
          )
          console.log(`Customer notified of ${newStatus} status for order ${currentOrder.id}`)
        }
      }

      // Trigger additional notifications based on status change
      if (currentOrder) {
        // When order is ready, notify drivers for potential pickup
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

  const isInDateRange = (order) => {
    if (dateFilter === 'all') return true
    
    const createdAt = order.createdAt
    if (!createdAt) return false
    
    const createdTs = new Date(createdAt).getTime()
    if (isNaN(createdTs)) return false
    
    const now = Date.now()
    let startTs = 0
    let endTs = now
    
    if (dateFilter === 'today') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      startTs = today.getTime()
    } else if (dateFilter === 'last7') {
      startTs = now - 7 * 24 * 60 * 60 * 1000
    } else if (dateFilter === 'last30') {
      startTs = now - 30 * 24 * 60 * 60 * 1000
    } else if (dateFilter === 'custom') {
      if (customStart) {
        const start = new Date(customStart)
        start.setHours(0, 0, 0, 0)
        startTs = start.getTime()
      }
      if (customEnd) {
        const end = new Date(customEnd)
        end.setHours(23, 59, 59, 999)
        endTs = end.getTime()
      }
    }
    
    return createdTs >= startTs && createdTs <= endTs
  }

  const filteredOrders = orders.filter(order => {
    const statusMatch = filter === 'all' ? true : order.status === filter
    return statusMatch && isInDateRange(order)
  })

  const getNextStatus = (currentStatus) => {
    const merchantControlledStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'handed-to-driver']
    const currentIndex = merchantControlledStatuses.indexOf(currentStatus)
    if (currentIndex === -1 || currentIndex >= merchantControlledStatuses.length - 1) return null
    return merchantControlledStatuses[currentIndex + 1]
  }

  const canAdvanceStatus = (status) => {
    return ['pending', 'confirmed', 'preparing', 'ready'].includes(status)
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

      {/* Date Filter */}
      <div className="space-y-3">
        <div className="flex space-x-2 overflow-x-auto">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              dateFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => setDateFilter('today')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              dateFilter === 'today'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setDateFilter('last7')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              dateFilter === 'last7'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setDateFilter('last30')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              dateFilter === 'last30'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setDateFilter('custom')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              dateFilter === 'custom'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Custom Range
          </button>
        </div>

        {/* Custom Date Range */}
        {dateFilter === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>
        )}
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
                    <p className="font-semibold text-gray-900">{formatCurrency(order.subtotal || order.total)}</p>
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
                        <span className="font-medium text-gray-900">Product Amount</span>
                        <span className="font-bold text-lg text-gray-900">{formatCurrency(order.subtotal || order.total)}</span>
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