package com.kaibairen.startup

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object StartupLog {
  const val TAG = "AgentsStartup"
  private const val FILE = "startup.log"

  fun write(context: Context?, stage: String) {
    val line = buildString {
      append(now())
      append(' ')
      append(stage)
      append(" sdk=")
      append(Build.VERSION.SDK_INT)
      append(" rel=")
      append(Build.VERSION.RELEASE)
      append(" brand=")
      append(Build.BRAND)
      append(" model=")
      append(Build.MODEL)
      if (context != null) {
        append(" record=")
        append(recordState(context))
      }
    }
    Log.e(TAG, line)
    if (context == null) return
    try {
      File(context.filesDir, FILE).appendText(line + "\n")
      context.getExternalFilesDir(null)?.let { dir ->
        File(dir, FILE).appendText(line + "\n")
      }
    } catch (error: Exception) {
      Log.e(TAG, "write-file-failed ${error.message}")
    }
  }

  fun read(context: Context?): String {
    if (context == null) return ""
    return try {
      File(context.filesDir, FILE).takeIf { it.exists() }?.readText() ?: ""
    } catch (_: Exception) {
      ""
    }
  }

  private fun now(): String {
    return SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(Date())
  }

  private fun recordState(context: Context): String {
    val declared = try {
      val info = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)
      info.requestedPermissions?.contains(Manifest.permission.RECORD_AUDIO) == true
    } catch (_: Exception) {
      false
    }
    val granted = context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    return "declared=$declared granted=$granted"
  }
}
