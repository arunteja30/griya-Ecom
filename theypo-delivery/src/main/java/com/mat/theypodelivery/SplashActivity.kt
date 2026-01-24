package com.mat.theypodelivery

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.appcompat.app.AppCompatActivity

/**
 * Splash screen shown on app launch
 */
class SplashActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.splash_screen)

        // Show splash for 2 seconds then navigate to main activity
        Handler(Looper.getMainLooper()).postDelayed({
            startActivity(Intent(this, HybridWebActivity::class.java))
            finish()
        }, 2000)
    }
}
