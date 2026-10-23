import Darwin
import Foundation

final class SovelDiscovery {
  private let lock = NSLock()
  private var cancelled = false
  private var running = false
  func cancel() {
    lock.lock()
    cancelled = true
    lock.unlock()
  }
  func discover() throws -> [[String: String]] {
    lock.lock()
    if running {
      lock.unlock()
      throw NSError(
        domain: "SovelNetwork", code: 1, userInfo: [NSLocalizedDescriptionKey: "搜索正在进行"])
    }
    running = true
    cancelled = false
    lock.unlock()
    defer {
      lock.lock()
      running = false
      lock.unlock()
    }
    let probes = [
      ("jellyfin", "255.255.255.255", UInt16(7359), "who is JellyfinServer?"),
      ("emby", "255.255.255.255", UInt16(7359), "who is EmbyServer?"),
      (
        "dlna", "239.255.255.250", UInt16(1900),
        "M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 1\r\nST: urn:schemas-upnp-org:device:MediaServer:1\r\n\r\n"
      ),
    ]
    var replies = [[String: String]]()
    for (kind, host, port, message) in probes {
      lock.lock()
      let stop = cancelled
      lock.unlock()
      if stop { break }
      let fd = socket(AF_INET, SOCK_DGRAM, 0)
      guard fd >= 0 else { continue }
      defer { close(fd) }
      var yes: Int32 = 1
      setsockopt(fd, SOL_SOCKET, SO_BROADCAST, &yes, socklen_t(MemoryLayout.size(ofValue: yes)))
      var timeout = timeval(tv_sec: 0, tv_usec: 150_000)
      setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))
      var destination = sockaddr_in()
      destination.sin_family = sa_family_t(AF_INET)
      destination.sin_port = port.bigEndian
      inet_pton(AF_INET, host, &destination.sin_addr)
      let sent = message.withCString { bytes in
        withUnsafePointer(to: &destination) { ptr in
          ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            sendto(fd, bytes, message.utf8.count, 0, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
          }
        }
      }
      if sent < 0 { continue }
      let deadline = Date().addingTimeInterval(1.5)
      while Date() < deadline && replies.count < 256 {
        lock.lock()
        let stop = cancelled
        lock.unlock()
        if stop { return replies }
        var buffer = [UInt8](repeating: 0, count: 65536)
        var sender = sockaddr_in()
        var length = socklen_t(MemoryLayout<sockaddr_in>.size)
        let count = withUnsafeMutablePointer(to: &sender) { ptr in
          ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            recvfrom(fd, &buffer, buffer.count, 0, $0, &length)
          }
        }
        if count > 0, let value = String(bytes: buffer.prefix(count), encoding: .utf8) {
          var address = sender.sin_addr
          var text = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
          inet_ntop(AF_INET, &address, &text, socklen_t(text.count))
          replies.append(["kind": kind, "address": String(cString: text), "data": value])
        }
      }
    }
    return replies
  }
}
