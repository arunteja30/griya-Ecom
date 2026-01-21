package com.mat.dootha

import android.app.Application
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.database.FirebaseDatabase

class DoothaApplication : Application() {

    companion object {
        private const val TAG = "DoothaApp"
    }

    override fun onCreate() {
        super.onCreate()

        Log.d(TAG, "🚀 Application starting...")

        // Initialize Firebase
        try {
            FirebaseApp.initializeApp(this)
            Log.d(TAG, "🔥 Firebase initialized successfully")

            // Get Firebase database instance
            val database = FirebaseDatabase.getInstance()
            Log.d(TAG, "📊 Firebase Database instance created: $database")

            // Enable offline persistence
            database.setPersistenceEnabled(true)
            Log.d(TAG, "💾 Firebase offline persistence enabled")

            // Test connection
            testFirebaseConnection()

        } catch (e: Exception) {
            Log.e(TAG, "❌ Firebase initialization failed", e)
        }
    }

    private fun testFirebaseConnection() {
        try {
            val database = FirebaseDatabase.getInstance()
            val reference = database.reference.child("test")

            Log.d(TAG, "🧪 Testing Firebase connection...")

            reference.setValue("connection_test")
                .addOnSuccessListener {
                    Log.d(TAG, "✅ Firebase connection test successful")
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "❌ Firebase connection test failed", e)
                }

        } catch (e: Exception) {
            Log.e(TAG, "❌ Exception during Firebase connection test", e)
        }
    }
}
