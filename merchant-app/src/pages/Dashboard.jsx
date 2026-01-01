import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ref, get } from 'firebase/database'
import { db } from '../firebase'
import { usePermissions } from '../context/PermissionContext'
import { SoundNotification } from '../utils/soundNotification'

const Dashboard = ({ merchant }) => {
  const { hasPermission } = usePermissions()
  const [stats, setStats] = useState({
    orders: { today: 0, pending: 0, total: 0 },
    products: { total: 0, outOfStock: 0 },
    revenue: { today: 0, month: 0 }
  })
  const [loading, setLoading] = useState(true)
  const [recentOrders, setRecentOrders] = useState([])

  useEffect(() => {
    loadDashboardData()
  }, [merchant])

  const loadDashboardData = async () => {
    try {
      // Load orders only if has permission
      if (hasPermission('orders')) {
        const ordersRef = ref(db, '/orders')
        const ordersSnapshot = await get(ordersRef)
        const orders = ordersSnapshot.val() || {}
        
        const ordersList = Object.entries(orders).filter(([_, order]) => 
          order.merchantId === merchant?.id
        )
        
        const today = new Date().toDateString()
        const currentMonth = new Date().getMonth()
        
        const todayOrders = ordersList.filter(([_, order]) => 
          new Date(order.createdAt).toDateString() === today
        )
        
        const monthlyOrders = ordersList.filter(([_, order]) => 
          new Date(order.createdAt).getMonth() === currentMonth
        )
        
        const pendingOrders = ordersList.filter(([_, order]) => 
          order.status === 'pending' || order.status === 'confirmed'
        )

        // Recent orders
        const recent = ordersList
          .sort(([a], [b]) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5)
          .map(([id, order]) => ({ id, ...order }))

        setRecentOrders(recent)
        
        setStats(prev => ({
          ...prev,
          orders: {
            today: todayOrders.length,
            pending: pendingOrders.length,
            total: ordersList.length
          },
          revenue: {
            today: todayOrders.reduce((sum, [_, order]) => sum + (order.totalAmount || 0), 0),
            month: monthlyOrders.reduce((sum, [_, order]) => sum + (order.totalAmount || 0), 0)
          }
        }))
      }
      
      // Load products only if has permission
      if (hasPermission('products')) {
        const productsRef = ref(db, `/merchants/${merchant?.id}/products`)
        const productsSnapshot = await get(productsRef)
        const products = productsSnapshot.val() || {}
        
        const productsList = Object.values(products)
        const outOfStockProducts = productsList.filter(product => 
          !product.inStock || (product.stock !== undefined && product.stock <= 0)
        )

        setStats(prev => ({
          ...prev,
          products: {
            total: productsList.length,
            outOfStock: outOfStockProducts.length
          }
        }))
      }

      setLoading(false)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount || 0)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'confirmed': return 'bg-blue-100 text-blue-800'
      case 'preparing': return 'bg-purple-100 text-purple-800'
      case 'ready': return 'bg-green-100 text-green-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
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
      {/* Welcome Section */}
      <div className="card p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Welcome back, {merchant?.name}!</h2>
            <p className="text-gray-600">{merchant?.storeName}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {hasPermission('orders') && (
          <>
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Today's Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.orders.today}</p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.orders.pending}</p>
                </div>
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Today's Revenue</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.revenue.today)}</p>
                </div>
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
              </div>
            </div>
          </>
        )}

        {hasPermission('products') && (
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Products</p>
                <p className="text-2xl font-bold text-gray-900">{stats.products.total}</p>
                {stats.products.outOfStock > 0 && (
                  <p className="text-xs text-red-600">{stats.products.outOfStock} out of stock</p>
                )}
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Orders */}
      {hasPermission('orders') && (
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Recent Orders</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {recentOrders.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p>No orders yet</p>
              </div>
            ) : (
              recentOrders.map((order, index) => (
                <div key={order.id || index} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">
                          Order #{order.id?.substring(0, 8)}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {order.address?.name} • {formatCurrency(order.totalAmount)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.createdAt).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-4">
          {hasPermission('products') && (
            <Link to="/products" className="btn-primary p-6 flex flex-col items-center space-y-2 no-underline">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Product</span>
            </Link>
          )}
          {hasPermission('orders') && (
            <Link to="/orders" className="btn-secondary p-6 flex flex-col items-center space-y-2 no-underline">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>View Orders</span>
            </Link>
          )}
        </div>
        
        {hasPermission('analytics') && (
          <Link to="/analytics" className="btn-primary p-6 flex items-center justify-center space-x-2 no-underline">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>View Analytics</span>
          </Link>
        )}
      </div>
    </div>
  )
}

export default Dashboard