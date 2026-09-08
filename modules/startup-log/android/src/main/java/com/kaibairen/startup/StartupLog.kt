package com.kaibairen.startup

import android.Manifest
import android.app.Application
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.system.Os
import android.system.OsConstants
import android.util.Log
import android.widget.Toast
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.system.exitProcess

object StartupLog {
  const val TAG = "AgentsStartup"
  const val EXTRA_CRASH = "crash"
  private const val FILE = "startup.log"
  private const val LAST = "startup.last"
  private const val CRASH = "startup.crash"

  @Volatile
  private var showingCrash = false

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

  fun isCrashProcess(context: Context? = null): Boolean {
    return processName().endsWith(":crash")
  }

  fun installHandler(context: Context?) {
    val app = context?.applicationContext ?: context ?: return
    if (isCrashProcess(app)) return
    val current = Thread.getDefaultUncaughtExceptionHandler()
    if (current is StartupCrashHandler) return
    Thread.setDefaultUncaughtExceptionHandler(StartupCrashHandler(app, current))
  }

  fun showAndDie(context: Context?, stage: String, error: Throwable) {
    showCrashScreen(context, formatCrash(stage, Thread.currentThread(), error), die = true)
  }

  fun showCrashScreen(context: Context?, detail: String, die: Boolean) {
    val text = detail.take(12000)
    Log.e(TAG, text)
    if (context != null) {
      write(context, "crash-ui ${text.take(400)}")
      try {
        persist(File(context.filesDir, CRASH), text, append = false)
      } catch (error: Exception) {
        Log.e(TAG, "write-crash-failed ${error.message}")
      }
    }
    if (context == null || isCrashProcess(context) || showingCrash) {
      if (die) killSelf()
      return
    }
    showingCrash = true
    try {
      val intent = Intent(context, CrashActivity::class.java)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      intent.putExtra(EXTRA_CRASH, text.take(7000))
      context.applicationContext.startActivity(intent)
      try {
        Thread.sleep(300)
      } catch (_: InterruptedException) {
      }
    } catch (error: Exception) {
      Log.e(TAG, "crash-ui-fail ${error.message}")
      try {
        Toast.makeText(context.applicationContext, text.take(180), Toast.LENGTH_LONG).show()
        Thread.sleep(2000)
      } catch (_: Exception) {
      }
    }
    if (die) killSelf()
  }

  fun formatCrash(stage: String, thread: Thread, error: Throwable): String {
    return try {
      buildString {
        append(stage)
        append("\nthread=")
        append(thread.name)
        append('\n')
        append(error.javaClass.name)
        append(": ")
        append(error.message ?: "")
        append("\n\n")
        append(error.stackTraceToString().take(7000))
        val cause = error.cause
        if (cause != null && cause !== error) {
          append("\nCaused by: ")
          append(cause.stackTraceToString().take(2000))
        }
      }
    } catch (_: Throwable) {
      "$stage ${error.javaClass.name}: ${error.message}"
    }
  }

  private fun processName(): String {
    if (Build.VERSION.SDK_INT >= 28) return Application.getProcessName()
    return try {
      File("/proc/self/cmdline").readText().trim { it <= ' ' || it == '\u0000' }
    } catch (_: Exception) {
      ""
    }
  }

  private fun killSelf() {
    Process.killProcess(Process.myPid())
    exitProcess(10)
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

class StartupCrashHandler(
  private val app: Context,
  private val previous: Thread.UncaughtExceptionHandler?,
) : Thread.UncaughtExceptionHandler {
  override fun uncaughtException(thread: Thread, error: Throwable) {
    if (StartupLog.isCrashProcess(app)) {
      previous?.uncaughtException(thread, error)
      return
    }
    try {
      StartupLog.showCrashScreen(app, StartupLog.formatCrash("uncaught", thread, error), die = true)
    } catch (_: Throwable) {
      previous?.uncaughtException(thread, error)
    }
  }
}
