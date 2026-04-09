package com.ndrive.cloudvault

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class NDriveApp : Application() {
    override fun onCreate() {
        super.onCreate()
    }
}
