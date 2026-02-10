package com.mat.purnidelivery.base

/**
 * Base interface for permission management across all activities
 */
interface PermissionManager {
    interface PermissionCallback {
        fun onGranted()
        fun onDenied()
    }
}
