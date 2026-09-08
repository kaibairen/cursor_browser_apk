package com.kaibairen.startup

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import android.util.Log

class StartupLogProvider : ContentProvider() {
  override fun onCreate(): Boolean {
    return try {
      StartupLog.installHandler(context)
      StartupLog.write(context, "provider.onCreate")
      true
    } catch (error: Throwable) {
      Log.e(StartupLog.TAG, "provider.onCreate fail ${error.javaClass.name} ${error.message}")
      true
    }
  }

  override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? = null
  override fun getType(uri: Uri): String? = null
  override fun insert(uri: Uri, values: ContentValues?): Uri? = null
  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
}
