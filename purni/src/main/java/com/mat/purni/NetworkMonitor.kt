package com.mat.purni

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build

/**
 * Monitors network connectivity changes and notifies listener.
 */
class NetworkMonitor(
    private val context: Context,
    private val listener: NetworkListener
) {

    interface NetworkListener {
        fun onNetworkAvailable()
        fun onNetworkLost()
    }

    private var isConnected = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            checkNetworkConnection()
        }
    }

    fun register() {
        val filter = IntentFilter(ConnectivityManager.CONNECTIVITY_ACTION)
        context.registerReceiver(receiver, filter)
        checkNetworkConnection() // Initial check
    }

    fun unregister() {
        try {
            context.unregisterReceiver(receiver)
        } catch (e: IllegalArgumentException) {
            // Already unregistered
        }
    }

    private fun checkNetworkConnection() {
        val connectivityManager =
            context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val wasConnected = isConnected

        isConnected = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = connectivityManager.activeNetwork
            val capabilities = connectivityManager.getNetworkCapabilities(network)
            capabilities != null && (
                    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
                    )
        } else {
            @Suppress("DEPRECATION")
            val networkInfo = connectivityManager.activeNetworkInfo
            networkInfo != null && networkInfo.isConnected
        }

        // Notify only on state change
        if (isConnected && !wasConnected) {
            listener.onNetworkAvailable()
        } else if (!isConnected && wasConnected) {
            listener.onNetworkLost()
        }
    }

    fun isCurrentlyConnected(): Boolean = isConnected
}
