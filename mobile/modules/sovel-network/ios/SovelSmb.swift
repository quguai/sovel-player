import Foundation
import Network
import SMBClient

actor SovelSMBHub {
  private var clients = [String: SMBClient]()
  private var proxy: SovelSMBProxy?
  func connect(
    _ id: String, _ host: String, _ port: Int, _ username: String, _ password: String,
    _ share: String
  ) async throws -> String {
    guard !share.isEmpty, (1...65535).contains(port) else { throw URLError(.badURL) }
    let client = SMBClient(host: host, port: port)
    let parts = username.split(separator: "\\", maxSplits: 1).map(String.init)
    do {
      try await request(client) {
        try await client.login(
          username: parts.last?.isEmpty == false ? parts.last : nil,
          password: password.isEmpty ? nil : password, domain: parts.count > 1 ? parts[0] : nil)
      }
      try await request(client) { try await client.connectShare(share) }
      await closeSession(id)
      clients[id] = client
      if proxy == nil { proxy = try SovelSMBProxy(hub: self) }
      return try await proxy!.baseURL() + id.addingPercentEncoding(
        withAllowedCharacters: .urlPathAllowed)! + "/"
    } catch {
      client.session.disconnect()
      if clients[id] === client { clients.removeValue(forKey: id) }
      throw error
    }
  }
  private func request<T>(_ client: SMBClient, operation: () async throws -> T) async throws -> T {
    // A cancelled NWConnection resumes the library's pending connect/read continuation.
    let deadline = DispatchWorkItem { client.session.disconnect() }
    DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 20, execute: deadline)
    defer { deadline.cancel() }
    return try await operation()
  }
  func client(_ id: String) throws -> SMBClient {
    guard let value = clients[id] else {
      throw NSError(
        domain: "SovelNetwork", code: 2, userInfo: [NSLocalizedDescriptionKey: "SMB 来源尚未连接"])
    }
    return value
  }
  func validate(_ path: String) throws {
    if path.contains("\0")
      || path.replacingOccurrences(of: "\\", with: "/").split(separator: "/").contains("..")
    {
      throw URLError(.badURL)
    }
  }
  func list(_ id: String, _ path: String) async throws -> [[String: Any]] {
    try validate(path)
    let c = try client(id)
    return try await request(c) { try await c.listDirectory(path: path) }.filter {
      $0.name != "." && $0.name != ".."
    }.map {
      [
        "name": $0.name, "directory": $0.isDirectory, "size": Double($0.size),
        "mtime": $0.lastWriteTime.timeIntervalSince1970 * 1000,
      ]
    }
  }
  func read(_ id: String, _ path: String, _ offset: UInt64, _ length: Int) async throws -> Data {
    try validate(path)
    guard length >= 0 && length <= 16 * 1024 * 1024 else {
      throw URLError(.dataLengthExceedsMaximum)
    }
    let c = try client(id)
    let reader = try c.fileReader(path: path)
    return try await request(c) {
      do {
        let data = try await reader.read(offset: offset, length: UInt32(length))
        try await reader.close()
        return data
      } catch {
        try? await reader.close()
        throw error
      }
    }
  }

  func size(_ id: String, _ path: String) async throws -> UInt64 {
    try validate(path)
    let c = try client(id)
    return try await request(c) { try await c.fileStat(path: path).size }
  }
  func closeSession(_ id: String) async {
    if let old = clients.removeValue(forKey: id) {
      try? await request(old) { try await old.logoff() }
      old.session.disconnect()
    }
  }
  func closeAll() async {
    for id in Array(clients.keys) { await closeSession(id) }
    proxy?.stop()
    proxy = nil
  }
}

final class SovelSMBProxy: @unchecked Sendable {
  private let listener: NWListener
  private let hub: SovelSMBHub
  private let token = UUID().uuidString
  private let queue = DispatchQueue(label: "Sovel.SMB.HTTP")
  init(hub: SovelSMBHub) throws {
    self.hub = hub
    let params = NWParameters.tcp
    params.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: .any)
    listener = try NWListener(using: params)
    listener.newConnectionHandler = { [weak self] connection in
      guard let self else {
        connection.cancel()
        return
      }
      connection.start(queue: self.queue)
      self.receive(connection, Data())
    }
    listener.start(queue: queue)
  }
  func stop() { listener.cancel() }
  func baseURL() async throws -> String {
    for _ in 0..<100 {
      if let port = listener.port, port.rawValue != 0 {
        return "http://127.0.0.1:\(port.rawValue)/\(token)/"
      }
      try await Task.sleep(nanoseconds: 10_000_000)
    }
    throw URLError(.cannotConnectToHost)
  }
  private func receive(_ connection: NWConnection, _ previous: Data) {
    connection.receive(minimumIncompleteLength: 1, maximumLength: 16384) {
      [weak self] data, _, complete, error in
      guard let self, error == nil else {
        connection.cancel()
        return
      }
      var all = previous
      all.append(data ?? Data())
      guard all.count <= 32768 else {
        connection.cancel()
        return
      }
      if let text = String(data: all, encoding: .utf8), text.contains("\r\n\r\n") {
        Task { await self.serve(connection, text) }
      } else if !complete {
        self.receive(connection, all)
      } else {
        connection.cancel()
      }
    }
  }
  private func send(_ connection: NWConnection, _ data: Data) async throws {
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      connection.send(
        content: data,
        completion: .contentProcessed { error in
          if let error { continuation.resume(throwing: error) } else { continuation.resume() }
        })
    }
  }
  private func serve(_ connection: NWConnection, _ request: String) async {
    defer { connection.cancel() }
    do {
      let lines = request.components(separatedBy: "\r\n")
      let first = lines[0].split(separator: " ")
      guard first.count >= 2, first[0] == "GET" || first[0] == "HEAD" else {
        throw URLError(.badURL)
      }
      let parts = first[1].split(separator: "/", omittingEmptySubsequences: true)
      guard parts.count >= 3, parts[0] == token, let id = String(parts[1]).removingPercentEncoding,
        let path = parts.dropFirst(2).joined(separator: "/").removingPercentEncoding
      else { throw URLError(.badURL) }
      let size = try await hub.size(id, path)
      var start: UInt64 = 0
      var end = size > 0 ? size - 1 : 0
      var partial = false
      if let range = lines.first(where: { $0.lowercased().hasPrefix("range:") }) {
        let value = range.dropFirst(6).trimmingCharacters(in: .whitespaces)
        guard value.hasPrefix("bytes="), !value.contains(",") else { throw URLError(.badURL) }
        let bounds = value.dropFirst(6).split(separator: "-", omittingEmptySubsequences: false)
        guard bounds.count == 2 else { throw URLError(.badURL) }
        if bounds[0].isEmpty, let suffix = UInt64(bounds[1]), suffix > 0 {
          start = size > suffix ? size - suffix : 0
        } else {
          guard let lower = UInt64(bounds[0]) else { throw URLError(.badURL) }
          start = lower
          if !bounds[1].isEmpty {
            guard let upper = UInt64(bounds[1]) else { throw URLError(.badURL) }
            end = min(end, upper)
          }
        }
        partial = true
      }
      guard size > 0, start <= end, start < size else {
        try await send(
          connection,
          Data(
            "HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */\(size)\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
              .utf8))
        return
      }
      var headers =
        "HTTP/1.1 \(partial ? "206 Partial Content" : "200 OK")\r\nContent-Type: application/octet-stream\r\nAccept-Ranges: bytes\r\nContent-Length: \(end - start + 1)\r\nConnection: close\r\n"
      if partial { headers += "Content-Range: bytes \(start)-\(end)/\(size)\r\n" }
      try await send(connection, Data((headers + "\r\n").utf8))
      if first[0] == "HEAD" { return }
      while start <= end {
        let bytes = try await hub.read(id, path, start, Int(min(131072, end - start + 1)))
        if bytes.isEmpty { throw URLError(.cannotDecodeContentData) }
        try await send(connection, bytes)
        start += UInt64(bytes.count)
      }
    } catch {
      try? await send(
        connection,
        Data("HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".utf8))
    }
  }
}
