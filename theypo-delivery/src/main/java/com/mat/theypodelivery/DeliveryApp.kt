package com.mat.theypodelivery

import android.app.Application
import com.google.firebase.FirebaseApp

class DeliveryApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
    }
}