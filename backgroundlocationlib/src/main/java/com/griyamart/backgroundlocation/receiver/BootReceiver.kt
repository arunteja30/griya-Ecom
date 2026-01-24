package com.griyamart.backgroundlocation.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.griyamart.backgroundlocation.BackgroundLocationManager

/**
 * Boot receiver to restart location tracking after device reboot
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "Boot received: ${intent.action}")

        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            "com.htc.intent.action.QUICKBOOT_POWERON" -> {
                handleBootCompleted(context)
            }
        }
    }

    private fun handleBootCompleted(context: Context) {
        try {
            // Check if auto-restart is enabled and location tracking was active
            val manager = BackgroundLocationManager.getInstance(context)

            if (manager.shouldRestartAfterBoot()) {
                Log.d(TAG, "Restarting location tracking after boot")
                manager.restartFromBoot()
            } else {
                Log.d(TAG, "Auto-restart not enabled or was not tracking before boot")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling boot completed", e)
        }
    }
}
