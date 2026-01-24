package com.mat.theypodelivery.old

import android.app.Application
import com.google.firebase.FirebaseApp

class DeliveryApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
    }
}