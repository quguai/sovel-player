package expo.modules.sovelnetwork

import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI

object SovelHttp {
  fun read(url: String, headers: Map<String, String>, offset: Long, length: Int): ByteArray {
    val uri = URI(url)
    require(
      uri.scheme in listOf("http", "https") &&
        uri.userInfo == null &&
        offset >= 0 &&
        length in 1..16 * 1024 * 1024
    )
    val connection = uri.toURL().openConnection() as HttpURLConnection
    try {
      connection.connectTimeout = 20000
      connection.readTimeout = 20000
      connection.instanceFollowRedirects = false
      connection.useCaches = false
      headers.forEach { (name, value) -> connection.setRequestProperty(name, value) }
      connection.setRequestProperty("Range", "bytes=$offset-${offset+length-1}")
      require(
        connection.responseCode == 206 &&
          connection.getHeaderField("Content-Range")?.startsWith("bytes $offset-") == true &&
          connection.contentLengthLong <= length
      ) {
        "WebDAV 服务器需要支持 HTTP Range 分段读取"
      }
      return connection.inputStream.use { input ->
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(65536)
        while (true) {
          val n = input.read(buffer)
          if (n < 0) break
          require(output.size() + n <= length)
          output.write(buffer, 0, n)
        }
        output.toByteArray()
      }
    } finally {
      connection.disconnect()
    }
  }
}
