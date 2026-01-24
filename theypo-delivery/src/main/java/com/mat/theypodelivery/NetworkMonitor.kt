package com.mat.theypodelivery

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build

/**
 * Network connectivity monitor
 */
class NetworkMonitor(private val context: Context) {

    interface NetworkListener {
        fun onNetworkAvailable()
        fun onNetworkLost()
    }

    private var listener: NetworkListener? = null
    private var isRegistered = false

    private val networkReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (isNetworkAvailable()) {
                listener?.onNetworkAvailable()
            } else {
                listener?.onNetworkLost()
            }
        }
    }

    fun setListener(listener: NetworkListener) {
        this.listener = listener
    }

    fun register() {
        if (!isRegistered) {
            val filter = IntentFilter(ConnectivityManager.CONNECTIVITY_ACTION)
            context.registerReceiver(networkReceiver, filter)
            isRegistered = true
        }
    }

    fun unregister() {
        if (isRegistered) {
            context.unregisterReceiver(networkReceiver)
            isRegistered = false
        }
    }

    fun isNetworkAvailable(): Boolean {
        val connectivityManager =
            context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = connectivityManager.activeNetwork ?: return false
            val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } else {
            @Suppress("DEPRECATION")
            val networkInfo = connectivityManager.activeNetworkInfo
            networkInfo?.isConnected == true
        }
    }
}
