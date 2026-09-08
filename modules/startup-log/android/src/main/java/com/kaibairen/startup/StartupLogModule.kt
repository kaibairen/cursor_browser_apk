package com.kaibairen.startup

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class StartupLogModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("StartupLog")

    OnCreate {
      val ctx = appContext.reactContext ?: appContext.currentActivity
      StartupLog.installHandler(ctx)
      StartupLog.write(ctx, "module.OnCreate")
    }

    Function("write") { stage: String ->
      val ctx = appContext.reactContext ?: appContext.currentActivity
      StartupLog.write(ctx, stage)
    }

    Function("read") {
      val ctx = appContext.reactContext ?: appContext.currentActivity
      StartupLog.read(ctx)
    }

    Function("showCrash") { detail: String ->
      val ctx = appContext.reactContext ?: appContext.currentActivity
      StartupLog.showCrashScreen(ctx, detail, die = true)
    }
  }
}
