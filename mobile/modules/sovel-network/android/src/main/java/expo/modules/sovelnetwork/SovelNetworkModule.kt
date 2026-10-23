package expo.modules.sovelnetwork

import android.content.Context
import android.net.wifi.WifiManager
import android.util.Base64
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SovelNetworkModule : Module() {
  private val cancel = AtomicBoolean(false)
  private val discovering = AtomicBoolean(false)
  private val smb = SovelSmb()

  override fun definition() = ModuleDefinition {
    Name("SovelNetwork")
    Function("nonce") { java.util.UUID.randomUUID().toString().replace("-", "") }
    Function("cancelDiscovery") { cancel.set(true) }
    AsyncFunction("discover") Coroutine
      { ->
        withContext(Dispatchers.IO) {
          check(discovering.compareAndSet(false, true)) { "搜索正在进行" }
          cancel.set(false)
          val wifi =
            appContext.reactContext?.applicationContext?.getSystemService(Context.WIFI_SERVICE)
              as? WifiManager
          var lock: WifiManager.MulticastLock? = null
          try {
            lock = wifi?.createMulticastLock("SovelDiscovery")
            lock?.setReferenceCounted(false)
            lock?.acquire()
            discover()
          } finally {
            if (lock?.isHeld == true) lock.release()
            discovering.set(false)
          }
        }
      }
    AsyncFunction("smbConnect") Coroutine
      { id: String, host: String, port: Int, username: String, password: String, share: String ->
        withContext(Dispatchers.IO) { smb.connect(id, host, port, username, password, share) }
      }
    AsyncFunction("smbList") Coroutine
      { id: String, path: String ->
        withContext(Dispatchers.IO) { smb.list(id, path) }
      }
    AsyncFunction("smbRead") Coroutine
      { id: String, path: String, offset: Double, length: Int ->
        withContext(Dispatchers.IO) {
          Base64.encodeToString(smb.read(id, path, offset.toLong(), length), Base64.NO_WRAP)
        }
      }
    AsyncFunction("httpRead") Coroutine
      { url: String, headers: Map<String, String>, offset: Double, length: Int ->
        withContext(Dispatchers.IO) {
          Base64.encodeToString(
            SovelHttp.read(url, headers, offset.toLong(), length),
            Base64.NO_WRAP,
          )
        }
      }
    AsyncFunction("smbClose") Coroutine
      { id: String ->
        withContext(Dispatchers.IO) { smb.close(id) }
      }
    OnDestroy {
      cancel.set(true)
      smb.closeAll()
    }
  }

  private fun discover(): List<Map<String, String>> {
    val result = mutableListOf<Map<String, String>>()
    val probes =
      listOf(
        Triple("jellyfin", "255.255.255.255:7359", "who is JellyfinServer?"),
        Triple("emby", "255.255.255.255:7359", "who is EmbyServer?"),
        Triple(
          "dlna",
          "239.255.255.250:1900",
          "M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 1\r\nST: urn:schemas-upnp-org:device:MediaServer:1\r\n\r\n",
        ),
      )
    for ((kind, target, text) in probes) {
      if (cancel.get()) break
      DatagramSocket().use { socket ->
        socket.broadcast = true
        socket.soTimeout = 150
        val (host, port) = target.split(":")
        val data = text.toByteArray(Charsets.UTF_8)
        socket.send(DatagramPacket(data, data.size, InetAddress.getByName(host), port.toInt()))
        val end = System.nanoTime() + 1_500_000_000L
        while (!cancel.get() && System.nanoTime() < end && result.size < 256) {
          val packet = DatagramPacket(ByteArray(65536), 65536)
          try {
            socket.receive(packet)
            result.add(
              mapOf(
                "kind" to kind,
                "address" to packet.address.hostAddress.orEmpty(),
                "data" to String(packet.data, 0, packet.length, Charsets.UTF_8),
              )
            )
          } catch (_: java.net.SocketTimeoutException) {}
        }
      }
    }
    return result
  }
}
