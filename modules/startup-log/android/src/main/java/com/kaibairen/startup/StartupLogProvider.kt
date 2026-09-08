package com.kaibairen.startup

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri

class StartupLogProvider : ContentProvider() {
  override fun onCreate(): Boolean {
    val previous = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
      StartupLog.write(
        context,
        "uncaught thread=${thread.name} ${error.javaClass.name} ${error.message} ${error.stackTraceToString().take(1200)}",
      )
      previous?.uncaughtException(thread, error)
    }
    StartupLog.write(context, "provider.onCreate")
    return true
  }

  override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? = null
  override fun getType(uri: Uri): String? = null
  override fun insert(uri: Uri, values: ContentValues?): Uri? = null
  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
}
