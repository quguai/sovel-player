package expo.modules.audio

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import org.json.JSONObject
import java.io.File
import java.util.UUID
import kotlin.math.min
import kotlin.math.max

internal class SovelPlaybackState(context: Context) {
  private val prefs = context.getSharedPreferences("sovel.playback", Context.MODE_PRIVATE)
  private val handler = Handler(Looper.getMainLooper())
  private var token = ""
  private var lastWrite = Long.MIN_VALUE / 2
  private var lastIndex = -1
  private var lastPlaying = false
  private var deadline = 0L
  private var total = 0.0
  private var expired = false
  private var stop: (() -> Unit)? = null
  private val tick = object : Runnable {
    override fun run() { check(); if (deadline > 0) handler.postDelayed(this, 250) }
  }
  fun bind(identity: String) { token = identity; lastWrite = Long.MIN_VALUE / 2 }
  fun unbind() { token = "" }
  fun checkpoint(index: Int, position: Double, playing: Boolean, force: Boolean = false) {
    if (token.isEmpty() || index < 0 || !position.isFinite() || position < 0) return
    val now = SystemClock.elapsedRealtime()
    if (!force && now - lastWrite < 2000 && index == lastIndex && playing == lastPlaying) return
    prefs.edit().putString("checkpoint", JSONObject().put("token", token).put("index", index).put("position", position).toString()).apply()
    lastWrite = now; lastIndex = index; lastPlaying = playing
  }
  fun start(seconds: Double, stop: () -> Unit) {
    cancel(); expired = false
    if (!seconds.isFinite() || seconds <= 0) return
    total = seconds.coerceAtMost(86400.0)
    deadline = SystemClock.elapsedRealtime() + (total * 1000).toLong(); this.stop = stop
    handler.postDelayed(tick, minOf((total * 1000).toLong(), 250L))
  }
  fun check() {
    if (deadline <= 0 || SystemClock.elapsedRealtime() < deadline) return
    val callback = stop; cancel(); expired = true; callback?.invoke()
  }
  fun cancel() { handler.removeCallbacks(tick); deadline = 0; total = 0.0; stop = null }
  fun status(): Map<String, Any> {
    check()
    return mapOf("available" to true, "active" to (deadline > 0), "remaining" to maxOf(0.0, (deadline - SystemClock.elapsedRealtime()) / 1000.0), "seconds" to total, "expired" to expired)
  }
  companion object {
    fun saved(context: Context): Map<String, Any> = runCatching {
      val value = JSONObject(context.getSharedPreferences("sovel.playback", Context.MODE_PRIVATE).getString("checkpoint", "{}") ?: "{}")
      mapOf("token" to value.getString("token"), "index" to value.getInt("index"), "position" to value.getDouble("position"))
    }.getOrDefault(emptyMap())
  }
}

internal class SovelListeningHistory(context: Context) {
  private val folder = File(context.filesDir, "SovelListeningJournal")
  private var ids = emptyList<String>()
  private var record: MutableMap<String, Any>? = null
  private var lastClosed: MutableMap<String, Any>? = null
  private var ranges = mutableListOf<Pair<Double, Double>>()
  private data class Anchor(val position: Double, val time: Double, val playing: Boolean, val rate: Double)
  private var anchor: Anchor? = null
  private var lastWrite = Double.NEGATIVE_INFINITY
  private fun clock() = SystemClock.elapsedRealtime() / 1000.0
  private fun wall() = System.currentTimeMillis().toDouble()
  fun bind(trackIds: List<String>) { ids = trackIds; anchor = null }
  fun suspend() { flush(); ids = emptyList(); anchor = null }
  fun seek() {
    if (ids.isEmpty()) return
    record?.let { it["seekCount"] = (it["seekCount"] as Number).toInt() + 1 }
    anchor = null; flush()
  }
  fun sample(index: Int, position: Double, duration: Double, playing: Boolean, rate: Double = 1.0, force: Boolean = false) {
    if (index !in ids.indices || !position.isFinite() || !duration.isFinite() || position < 0) return
    val trackId = ids[index]; val now = clock()
    if (record != null && record!!["trackId"] != trackId) finish("transition")
    if (record == null) {
      if (!playing || (duration > 0 && position >= duration - 0.02)) return
      record = mutableMapOf("id" to UUID.randomUUID().toString(), "trackId" to trackId,
        "startedAt" to wall(), "updatedAt" to wall(), "duration" to max(0.0, duration),
        "listenedSeconds" to 0.0, "coveredSeconds" to 0.0, "reason" to "listening", "seekCount" to 0, "revision" to 0)
      ranges.clear(); anchor = null; lastWrite = Double.NEGATIVE_INFINITY
    }
    val changed = anchor?.playing != playing
    anchor?.let { previous ->
      val delta = position - previous.position; val elapsed = now - previous.time; val speed = max(0.01, previous.rate)
      if (previous.playing && elapsed > 0 && elapsed <= 3 && delta > 0 && delta <= elapsed * speed + 0.35) {
        record!!["listenedSeconds"] = (record!!["listenedSeconds"] as Number).toDouble() + min(elapsed, delta / speed)
        addRange(previous.position, min(position, max(0.0, duration)))
      }
    }
    record!!["duration"] = max(0.0, duration)
    record!!["coveredSeconds"] = min(max(0.0, duration), ranges.sumOf { max(0.0, it.second - it.first) })
    record!!["updatedAt"] = wall(); record!!["reason"] = if (playing) "listening" else "paused"
    anchor = Anchor(position, now, playing, if (rate.isFinite()) rate else 1.0)
    if (force || changed || now - lastWrite >= 5) flush()
  }
  private fun addRange(start: Double, end: Double) {
    if (end <= start) return
    val merged = mutableListOf<Pair<Double, Double>>()
    for (range in (ranges + (start to end)).sortedBy { it.first }) {
      val previous = merged.lastOrNull()
      if (previous != null && range.first <= previous.second + 0.001)
        merged[merged.lastIndex] = previous.first to max(previous.second, range.second)
      else merged.add(range)
    }
    ranges = merged
  }
  fun finish(reason: String) {
    record?.let { it["reason"] = reason; it["updatedAt"] = wall(); flush(); lastClosed = it.toMutableMap() }
    record = null; anchor = null; ranges.clear()
  }
  fun transition(index: Int, reason: String) {
    if (index !in ids.indices) return
    val id = ids[index]
    if (record?.get("trackId") == id) finish(reason)
    else lastClosed?.let { closed ->
      if (closed["trackId"] == id && closed["reason"] == "transition" && wall() - (closed["updatedAt"] as Number).toDouble() < 2000) {
        closed["reason"] = reason; closed["revision"] = (closed["revision"] as Number).toInt() + 1; persist(closed)
      }
    }
  }
  fun flush() {
    record?.let { it["revision"] = (it["revision"] as Number).toInt() + 1; persist(it); lastWrite = clock() }
  }
  private fun persist(entry: Map<String, Any>) = synchronized(journalLock) {
    try {
      folder.mkdirs()
      val file = android.util.AtomicFile(File(folder, "${entry["id"]}.json"))
      val stream = file.startWrite()
      try { stream.write(JSONObject(entry).toString().toByteArray(Charsets.UTF_8)); file.finishWrite(stream) }
      catch (error: Exception) { file.failWrite(stream); throw error }
    } catch (error: Exception) { android.util.Log.e("Sovel", "Listening journal write failed", error) }
  }
  companion object {
    private val journalLock = Any()
    fun pending(context: Context): List<Map<String, Any>> = synchronized(journalLock) {
      File(context.filesDir, "SovelListeningJournal").listFiles()?.filter { it.extension == "json" }
        ?.sortedBy { it.name }?.take(100)?.mapNotNull { file -> runCatching {
          val json = JSONObject(file.readText()); json.keys().asSequence().associateWith { json.get(it) }
        }.getOrNull() } ?: emptyList()
    }
    fun acknowledge(context: Context, entries: List<Map<String, Any>>) = synchronized(journalLock) {
      for (entry in entries) runCatching {
        val id = entry["id"] as String; UUID.fromString(id)
        val file = File(context.filesDir, "SovelListeningJournal/$id.json")
        val json = JSONObject(file.readText())
        if (json.getInt("revision") == (entry["revision"] as Number).toInt()) file.delete()
      }
    }
  }
}
