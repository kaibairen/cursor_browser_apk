package com.kaibairen.startup

import android.app.Activity
import android.app.Application
import android.content.Context
import android.os.Bundle
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class StartupLogPackage : Package {
  override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> {
    return listOf(
      object : ApplicationLifecycleListener {
        override fun onCreate(application: Application) {
          StartupLog.write(application, "application.onCreate")
        }
      },
    )
  }

  override fun createReactActivityLifecycleListeners(activityContext: Context?): List<ReactActivityLifecycleListener> {
    return listOf(
      object : ReactActivityLifecycleListener {
        override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
          StartupLog.write(activity, "activity.onCreate")
        }

        override fun onResume(activity: Activity) {
          StartupLog.write(activity, "activity.onResume")
        }

        override fun onDestroy(activity: Activity) {
          StartupLog.write(activity, "activity.onDestroy")
        }
      },
    )
  }
}
