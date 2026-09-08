package com.kaibairen.startup

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.util.TypedValue
import android.widget.ScrollView
import android.widget.TextView
import java.io.File

class CrashActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val extra = intent.getStringExtra(StartupLog.EXTRA_CRASH).orEmpty()
    val file = readFile("startup.crash")
    val last = readFile("startup.last")
    val body = buildString {
      append("启动崩溃（请截图发给我）\n\n")
      append(extra.ifBlank { file }.ifBlank { "没有捕获到异常文本。进程在弹出页之前就死了（多半是 .so / 信号）。" })
      if (last.isNotBlank()) {
        append("\n\n最后打点\n")
        append(last.trim())
      }
    }

    window.decorView.setBackgroundColor(Color.WHITE)
    val scroll = ScrollView(this)
    val pad = (20 * resources.displayMetrics.density).toInt()
    scroll.setPadding(pad, pad * 2, pad, pad * 2)
    val text = TextView(this)
    text.text = body
    text.setTextIsSelectable(true)
    text.setTextColor(Color.parseColor("#111111"))
    text.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
    text.setLineSpacing(6f, 1f)
    scroll.addView(text)
    setContentView(scroll)
  }

  private fun readFile(name: String): String {
    return try {
      File(filesDir, name).takeIf { it.exists() }?.readText().orEmpty()
    } catch (_: Exception) {
      ""
    }
  }
}
