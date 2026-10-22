package cn.quguai.sovel.updates

import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.content.FileProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@Suppress("DEPRECATION")
class SovelUpdatesModule : Module() {
  private val worker = Executors.newSingleThreadExecutor()
  private val running = AtomicBoolean(false)
  private val cancelled = AtomicBoolean(false)
  private val main = Handler(Looper.getMainLooper())
  @Volatile private var connection: HttpURLConnection? = null
  @Volatile private var state: Map<String, Any> = mapOf("phase" to "idle", "received" to 0, "total" to 0)
  private var readyHash = ""
  private var readyCode = 0L
  private val context get() = requireNotNull(appContext.reactContext) { "应用未就绪" }
  private val directory get() = File(context.cacheDir, "sovel-updates").also { it.mkdirs() }
  private val apk get() = File(directory, "update.apk")

  override fun definition() = ModuleDefinition {
    Name("SovelUpdates")
    OnDestroy {
      cancelled.set(true)
      connection?.disconnect()
      worker.shutdown()
    }
    Function("appInfo") {
      val info = context.packageManager.getPackageInfo(context.packageName, 0)
      mapOf("version" to (info.versionName ?: "0.0.0"), "code" to versionCode(info).toDouble(), "packageId" to context.packageName, "supportedAbis" to Build.SUPPORTED_ABIS.toList())
    }
    Function("isWifi") { isWifi() }
    Function("downloadState") { state }
    Function("cancelDownload") {
      cancelled.set(true)
      connection?.disconnect()
    }
    AsyncFunction("download") { url: String, sha256: String, size: Double, code: Double, wifiOnly: Boolean, promise: Promise ->
      if (!running.compareAndSet(false, true)) {
        promise.reject("DOWNLOAD_BUSY", "安装包正在下载", null)
      } else {
        cancelled.set(false)
        readyHash = ""
        readyCode = 0
        state = mapOf("phase" to "downloading", "received" to 0, "total" to size)
        worker.execute {
          val partial = File(directory, "update.part")
          try {
            require(Regex("[0-9a-f]{64}").matches(sha256) && size.isFinite() && size > 0 && size <= 1073741824 && code.isFinite() && code % 1.0 == 0.0) { "安装包信息无效" }
            require(!wifiOnly || isWifi()) { "请连接 Wi-Fi 后重试" }
            apk.delete()
            val http = openDownload(url)
            connection = http
            val digest = MessageDigest.getInstance("SHA-256")
            var received = 0L
            http.inputStream.use { input ->
              partial.outputStream().use { output ->
                val buffer = ByteArray(65536)
                while (true) {
                  check(!cancelled.get()) { "下载已取消" }
                  check(!wifiOnly || isWifi()) { "Wi-Fi 已断开，请重新下载" }
                  val count = input.read(buffer)
                  if (count < 0) break
                  received += count
                  check(received <= size.toLong()) { "安装包大小不匹配" }
                  digest.update(buffer, 0, count)
                  output.write(buffer, 0, count)
                  state = mapOf("phase" to "downloading", "received" to received.toDouble(), "total" to size)
                }
              }
            }
            check(!cancelled.get()) { "下载已取消" }
            check(received == size.toLong() && hex(digest.digest()) == sha256) { "安装包校验失败，请重新下载" }
            state = mapOf("phase" to "verifying", "received" to size, "total" to size)
            validateApk(partial, code.toLong())
            check(partial.renameTo(apk)) { "无法保存安装包" }
            readyHash = sha256
            readyCode = code.toLong()
            state = mapOf("phase" to "ready", "received" to size, "total" to size, "sha256" to sha256, "versionCode" to code)
            promise.resolve()
          } catch (e: Exception) {
            partial.delete()
            apk.delete()
            val stopped = cancelled.get()
            state = mapOf("phase" to (if (stopped) "cancelled" else "error"), "received" to 0, "total" to 0, "error" to (if (stopped) "下载已取消" else e.message.orEmpty()))
            promise.reject(if (stopped) "CANCELLED" else "DOWNLOAD_FAILED", e.message, e)
          } finally {
            connection?.disconnect()
            connection = null
            running.set(false)
          }
        }
      }
    }
    AsyncFunction("install") { promise: Promise ->
      worker.execute {
        try {
          check(readyHash.isNotEmpty() && state["phase"] == "ready" && apk.exists()) { "请先下载安装包" }
          val digest = MessageDigest.getInstance("SHA-256")
          apk.inputStream().use { input ->
            val buffer = ByteArray(65536)
            while (true) { val count = input.read(buffer); if (count < 0) break; digest.update(buffer, 0, count) }
          }
          check(hex(digest.digest()) == readyHash) { "安装包已改变，请重新下载" }
          validateApk(apk, readyCode)
          main.post {
            try {
              if (Build.VERSION.SDK_INT >= 26 && !context.packageManager.canRequestPackageInstalls()) {
                context.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                promise.resolve("permission")
              } else {
                val uri = FileProvider.getUriForFile(context, "${context.packageName}.sovel.updates", apk)
                context.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
                promise.resolve("installer")
              }
            } catch (e: Exception) { promise.reject("INSTALL_FAILED", e.message, e) }
          }
        } catch (e: Exception) { promise.reject("INSTALL_FAILED", e.message, e) }
      }
    }
  }

  private fun isWifi(): Boolean {
    val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val caps = manager.getNetworkCapabilities(manager.activeNetwork) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
      (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) || caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET))
  }
  private fun versionCode(info: PackageInfo): Long = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
  private fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it.toInt() and 255) }
  private fun signers(info: PackageInfo): Set<String> =
    (if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners else info.signatures)?.map { hex(it.toByteArray()) }?.toSet() ?: emptySet()
  private fun validateApk(file: File, expectedCode: Long) {
    val manager = context.packageManager
    val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
    val installed = manager.getPackageInfo(context.packageName, flags)
    val candidate = manager.getPackageArchiveInfo(file.absolutePath, flags) ?: error("无法读取安装包")
    check(candidate.packageName == context.packageName) { "安装包不属于 Sovel HiFi" }
    check((candidate.applicationInfo?.minSdkVersion ?: 0) <= Build.VERSION.SDK_INT) { "新版本不支持当前 Android 系统" }
    check(versionCode(candidate) == expectedCode && expectedCode > versionCode(installed)) { "安装包版本不匹配或不是较新版本" }
    val expected = signers(installed)
    check(expected.isNotEmpty() && expected == signers(candidate)) { "安装包签名不同，请从原安装渠道更新" }
  }
  private fun openDownload(address: String): HttpURLConnection {
    var next = address
    repeat(6) {
      check(!cancelled.get()) { "下载已取消" }
      val url = URL(next)
      check(url.protocol == "https" && (url.host == "github.com" || url.host == "release-assets.githubusercontent.com" || url.host == "objects.githubusercontent.com")) { "安装包下载地址不受支持" }
      val http = (url.openConnection() as HttpURLConnection).apply { connectTimeout = 15000; readTimeout = 30000; instanceFollowRedirects = false; setRequestProperty("User-Agent", "Sovel-HiFi") }
      connection = http
      val status = http.responseCode
      if (status in listOf(301, 302, 303, 307, 308)) {
        val location = http.getHeaderField("Location") ?: error("下载重定向无效")
        next = URL(url, location).toString()
        http.disconnect()
      } else {
        check(status == 200) { "下载失败：HTTP $status" }
        return http
      }
    }
    error("下载重定向次数过多")
  }
}
