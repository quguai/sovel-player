import ExpoModulesCore
import Foundation

public final class SovelNetworkModule: Module {
  private let discovery = SovelDiscovery()
  private let smb = SovelSMBHub()
  public func definition() -> ModuleDefinition {
    Name("SovelNetwork")
    Function("nonce") { UUID().uuidString.replacingOccurrences(of: "-", with: "") }
    AsyncFunction("discover") { try self.discovery.discover() }.runOnQueue(.global(qos: .utility))
    Function("cancelDiscovery") { self.discovery.cancel() }
    AsyncFunction("smbConnect") {
      (id: String, host: String, port: Int, username: String, password: String, share: String)
        async throws -> String in
      try await self.smb.connect(id, host, port, username, password, share)
    }
    AsyncFunction("smbList") { (id: String, path: String) async throws -> [[String: Any]] in
      try await self.smb.list(id, path)
    }
    AsyncFunction("smbRead") {
      (id: String, path: String, offset: Double, length: Int) async throws -> String in
      try await self.smb.read(id, path, UInt64(max(0, offset)), length).base64EncodedString()
    }
    AsyncFunction("httpRead") {
      (url: String, headers: [String: String], offset: Int, length: Int) async throws -> String in
      try await SovelHttpRead(offset: offset, limit: length).read(url, headers)
    }
    AsyncFunction("smbClose") { (id: String) async in await self.smb.closeSession(id) }
    OnDestroy {
      self.discovery.cancel()
      Task { await self.smb.closeAll() }
    }
  }
}
