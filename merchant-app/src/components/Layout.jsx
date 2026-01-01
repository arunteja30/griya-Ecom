import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import MobileNavigation from './MobileNavigation'
import NotificationBell from './NotificationBell'

const Layout = ({ merchant, onLogout, children }) => {
  const location = useLocation()
  const [showMenu, setShowMenu] = useState(false)

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/dashboard':
        return 'Dashboard'
      case '/orders':
        return 'Orders'
      case '/products':
        return 'Products'
      case '/settings':
        return 'Settings'
      default:
        return 'Merchant Portal'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="mobile-header flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">{getPageTitle()}</h1>
            <p className="text-xs text-gray-500">{merchant?.storeName}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Notification Bell */}
          <NotificationBell merchant={merchant} />

          {/* Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-3 border-b border-gray-100">
                    <p className="font-medium text-gray-900">{merchant?.name}</p>
                    <p className="text-sm text-gray-500">{merchant?.id}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      to="/settings"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setShowMenu(false)}
                    >
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        onLogout()
                        setShowMenu(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mobile-content">
        {children}
      </main>

      {/* Mobile Navigation */}
      <MobileNavigation />
    </div>
  )
}

export default Layout