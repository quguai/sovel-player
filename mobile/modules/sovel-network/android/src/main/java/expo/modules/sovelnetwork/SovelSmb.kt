package expo.modules.sovelnetwork

import com.hierynomus.msdtyp.AccessMask
import com.hierynomus.mssmb2.SMB2CreateDisposition
import com.hierynomus.mssmb2.SMB2ShareAccess
import com.hierynomus.smbj.SMBClient
import com.hierynomus.smbj.SmbConfig
import com.hierynomus.smbj.auth.AuthenticationContext
import com.hierynomus.smbj.share.DiskShare
import fi.iki.elonen.NanoHTTPD
import java.io.InputStream
import java.net.URLEncoder
import java.util.EnumSet
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

class SovelSmb {
  private data class Entry(
    val client: SMBClient,
    val connection: com.hierynomus.smbj.connection.Connection,
    val session: com.hierynomus.smbj.session.Session,
    val share: DiskShare,
  )

  private val entries = ConcurrentHashMap<String, Entry>()
  private val token = UUID.randomUUID().toString()
  private val server =
    object : NanoHTTPD("127.0.0.1", 0) {
      override fun serve(session: IHTTPSession): Response =
        try {
          require(session.method == Method.GET || session.method == Method.HEAD)
          val parts = session.uri.split('/').filter { it.isNotEmpty() }
          require(parts.size >= 3 && parts[0] == token)
          val id = parts[1]
          val path = clean(parts.drop(2).joinToString("/"))
          val entry = entries[id] ?: error("Source unavailable")
          val size = entry.share.getFileInformation(path).standardInformation.endOfFile
          var start = 0L
          var end = size - 1
          val range = session.headers["range"]
          if (range != null) {
            require(range.startsWith("bytes=") && !range.contains(','))
            val values = range.removePrefix("bytes=").split('-', limit = 2)
            require(values.size == 2)
            if (values[0].isEmpty()) {
              val suffix = values[1].toLong()
              require(suffix > 0)
              start = (size - suffix).coerceAtLeast(0)
            } else {
              start = values[0].toLong()
              if (values[1].isNotEmpty()) end = minOf(end, values[1].toLong())
            }
          }
          if (start < 0 || start > end || start >= size) {
            newFixedLengthResponse(Response.Status.RANGE_NOT_SATISFIABLE, "text/plain", "").apply {
              addHeader("Content-Range", "bytes */$size")
            }
          } else {
            val file = open(entry.share, path)
            val stream =
              object : InputStream() {
                var position = start

                override fun read(): Int {
                  val one = ByteArray(1)
                  return if (read(one, 0, 1) < 0) -1 else one[0].toInt() and 255
                }

                override fun read(b: ByteArray, off: Int, len: Int): Int {
                  if (len == 0) return 0
                  if (position > end) return -1
                  val count =
                    file.read(
                      b,
                      position,
                      off,
                      minOf(len.toLong(), end - position + 1, 131072).toInt(),
                    )
                  if (count > 0) position += count
                  return count
                }

                override fun close() {
                  file.close()
                }
              }
            newFixedLengthResponse(
                if (range == null) Response.Status.OK else Response.Status.PARTIAL_CONTENT,
                "application/octet-stream",
                stream,
                end - start + 1,
              )
              .apply {
                addHeader("Accept-Ranges", "bytes")
                if (range != null) addHeader("Content-Range", "bytes $start-$end/$size")
              }
          }
        } catch (_: Exception) {
          newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "")
        }
    }

  private fun clean(path: String): String {
    require(!path.contains('\u0000') && !path.replace('\\', '/').split('/').contains(".."))
    return path.replace('/', '\\')
  }

  private fun open(share: DiskShare, path: String) =
    share.openFile(
      clean(path),
      EnumSet.of(AccessMask.GENERIC_READ),
      null,
      SMB2ShareAccess.ALL,
      SMB2CreateDisposition.FILE_OPEN,
      null,
    )

  fun connect(
    id: String,
    host: String,
    port: Int,
    user: String,
    password: String,
    share: String,
  ): String {
    require(share.isNotBlank()) { "请输入共享文件夹，例如 smb://192.168.1.10/Music" }
    val client =
      SMBClient(
        SmbConfig.builder()
          .withTimeout(20, TimeUnit.SECONDS)
          .withSoTimeout(20, TimeUnit.SECONDS)
          .build()
      )
    val connection =
      try {
        client.connect(host, port)
      } catch (e: Exception) {
        client.close()
        throw e
      }
    try {
      val names = user.split('\\', limit = 2)
      val auth =
        if (user.isEmpty() && password.isEmpty()) AuthenticationContext.anonymous()
        else
          AuthenticationContext(
            names.last(),
            password.toCharArray(),
            if (names.size > 1) names[0] else "",
          )
      val session = connection.authenticate(auth)
      val disk = session.connectShare(share) as DiskShare
      close(id)
      entries[id] = Entry(client, connection, session, disk)
      if (!server.isAlive) server.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false)
      return "http://127.0.0.1:${server.listeningPort}/$token/${URLEncoder.encode(id,"UTF-8")}/"
    } catch (e: Exception) {
      connection.close()
      client.close()
      throw e
    }
  }

  fun list(id: String, path: String): List<Map<String, Any>> {
    val entry = entries[id] ?: error("SMB 来源尚未连接")
    return entry.share
      .list(clean(path))
      .filter { it.fileName != "." && it.fileName != ".." }
      .map {
        mapOf(
          "name" to it.fileName,
          "directory" to ((it.fileAttributes and 16L) != 0L),
          "size" to it.endOfFile.toDouble(),
          "mtime" to it.lastWriteTime.toEpochMillis().toDouble(),
        )
      }
  }

  fun read(id: String, path: String, offset: Long, length: Int): ByteArray {
    require(offset >= 0 && length in 0..16 * 1024 * 1024)
    val entry = entries[id] ?: error("SMB 来源尚未连接")
    return open(entry.share, path).use { file ->
      val bytes = ByteArray(length)
      var done = 0
      while (done < length) {
        val n = file.read(bytes, offset + done, done, minOf(131072, length - done))
        if (n <= 0) break
        done += n
      }
      bytes.copyOf(done)
    }
  }

  fun close(id: String) {
    entries.remove(id)?.let { entry ->
      runCatching { entry.share.close() }
      runCatching { entry.session.close() }
      runCatching { entry.connection.close() }
      runCatching { entry.client.close() }
    }
  }

  fun closeAll() {
    entries.keys.toList().forEach { close(it) }
    server.stop()
  }
}
