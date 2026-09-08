package com.kaibairen.startup

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.system.Os
import android.system.OsConstants
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object StartupLog {
  const val TAG = "AgentsStartup"
  private const val FILE = "startup.log"
  private const val LAST = "startup.last"

  fun write(context: Context?, stage: String) {
    val line = buildLine(context, stage)
    Log.e(TAG, line)
    if (context == null) return
    try {
      persist(File(context.filesDir, FILE), line, append = true)
      persist(File(context.filesDir, LAST), line, append = false)
    } catch (error: Exception) {
      Log.e(TAG, "write-filesDir-failed ${error.message}")
    }
    try {
      context.getExternalFilesDir(null)?.let { dir ->
        persist(File(dir, FILE), line, append = true)
        persist(File(dir, LAST), line, append = false)
      }
    } catch (error: Exception) {
      Log.e(TAG, "write-external-failed ${error.message}")
    }
  }

  fun read(context: Context?): String {
    if (context == null) return ""
    return try {
      val full = File(context.filesDir, FILE)
      val last = File(context.filesDir, LAST)
      buildString {
        if (last.exists()) {
          append("LAST ")
          append(last.readText().trim())
          append('\n')
        }
        if (full.exists()) {
          append(full.readText())
        }
      }
    } catch (_: Exception) {
      ""
    }
  }

  private fun persist(file: File, line: String, append: Boolean) {
    file.parentFile?.mkdirs()
    FileOutputStream(file, append).use { out ->
      out.write((line + "\n").toByteArray(Charsets.UTF_8))
      out.flush()
      out.fd.sync()
    }
  }

  private fun buildLine(context: Context?, stage: String): String {
    return buildString {
      append(now())
      append(" pid=")
      append(Process.myPid())
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
      append(" abi=")
      append(Build.SUPPORTED_ABIS.joinToString(","))
      append(" page=")
      append(pageSize())
      if (context != null) {
        append(" record=")
        append(recordState(context))
        append(' ')
        append(packageState(context))
        append(" video=")
        append(classPresent("expo.modules.video.VideoModule"))
        append(" so=")
        append(nativeLibs(context))
      }
    }
  }

  private fun now(): String {
    return SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(Date())
  }

  private fun pageSize(): String {
    return try {
      Os.sysconf(OsConstants._SC_PAGESIZE).toString()
    } catch (_: Exception) {
      "?"
    }
  }

  private fun recordState(context: Context): String {
    val declared = try {
      val info = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)
      info.requestedPermissions?.contains(Manifest.permission.RECORD_AUDIO) == true
    } catch (_: Exception) {
      false
    }
    val granted = try {
      context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    } catch (_: Exception) {
      false
    }
    return "declared=$declared granted=$granted"
  }

  private fun packageState(context: Context): String {
    return try {
      val info = context.packageManager.getPackageInfo(context.packageName, 0)
      val code = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
      "ver=${info.versionName} code=$code apk=${context.applicationInfo.sourceDir}"
    } catch (error: Exception) {
      "pkg-fail=${error.message}"
    }
  }

  private fun classPresent(name: String): String {
    return try {
      Class.forName(name, false, StartupLog::class.java.classLoader)
      "yes"
    } catch (_: ClassNotFoundException) {
      "no"
    } catch (error: Throwable) {
      "err=${error.javaClass.simpleName}"
    }
  }

  private fun nativeLibs(context: Context): String {
    return try {
      val names = File(context.applicationInfo.nativeLibraryDir).list()?.sorted().orEmpty()
      val marked = names.map { name ->
        when {
          name.contains("video", ignoreCase = true) -> "$name!"
          else -> name
        }
      }
      "${names.size}:${marked.joinToString(",")}"
    } catch (error: Exception) {
      "so-fail=${error.message}"
    }
  }
}
