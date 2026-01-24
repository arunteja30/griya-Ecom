package com.mat.theypo

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.appcompat.app.AppCompatActivity

/**
 * Splash screen for customer app.
 * Shows branding for 2 seconds then navigates to main activity.
 */
class SplashActivity : AppCompatActivity() {

    private val SPLASH_DISPLAY_DURATION = 2000L // 2 seconds

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // You can set a custom splash layout here
        // setContentView(R.layout.activity_splash)

        // For now, just use default theme with app icon
        supportActionBar?.hide()

        Handler(Looper.getMainLooper()).postDelayed({
            startActivity(Intent(this, HybridWebActivity::class.java))
            finish()
        }, SPLASH_DISPLAY_DURATION)
    }
}
