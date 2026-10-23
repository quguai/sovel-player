import XCTest

@testable import NetworkCore

final class NetworkTests: XCTestCase {
  func testNativeDiscovery() throws {
    let packets = try SovelDiscovery().discover()
    XCTAssertTrue(packets.contains { $0["kind"] == "jellyfin" })
    XCTAssertTrue(packets.contains { $0["kind"] == "emby" })
    XCTAssertTrue(packets.contains { $0["kind"] == "dlna" })
  }
  func testSMB2ReadsAndStreamingRanges() async throws {
    let hub = SovelSMBHub()
    let login = try await hub.connect("test", "127.0.0.1", 1445, "demo", "demo", "MUSIC")
    let files = try await hub.list("test", "")
    XCTAssertTrue(files.contains { $0["name"] as? String == "sample.wav" })
    let size = try await hub.size("test", "sample.wav")
    let first = try await hub.read("test", "sample.wav", 0, 64)
    XCTAssertEqual(String(data: first.prefix(4), encoding: .utf8), "RIFF")
    for range in ["bytes=0-63", "bytes=-64", "bytes=64-", "bytes=\(size)-"] {
      var req = URLRequest(url: URL(string: login + "sample.wav")!)
      req.setValue(range, forHTTPHeaderField: "Range")
      let (data, response) = try await URLSession.shared.data(for: req)
      let http = response as! HTTPURLResponse
      XCTAssertEqual(http.statusCode, range == "bytes=\(size)-" ? 416 : 206)
      if range == "bytes=0-63" { XCTAssertEqual(data, first) }
      if range == "bytes=-64" { XCTAssertEqual(data.count, 64) }
      if range == "bytes=64-" { XCTAssertEqual(UInt64(data.count), size - 64) }
    }
    do {
      _ = try await hub.list("test", "../secret")
      XCTFail("Traversal allowed")
    } catch {}
    await hub.closeAll()
  }
  func testBoundedHTTPRangeAndIgnoredRangeRejection() async throws {
    let auth = ["Authorization": "Basic ZGVtbzpkZW1v"]
    let data = try await SovelHttpRead(offset: 0, limit: 64).read(
      "http://127.0.0.1:18768/dav/sample.wav", auth)
    XCTAssertEqual(Data(base64Encoded: data)?.prefix(4), Data("RIFF".utf8))
    do {
      _ = try await SovelHttpRead(offset: 0, limit: 64).read(
        "http://127.0.0.1:18768/ignores-range", [:])
      XCTFail("Ignored Range accepted")
    } catch {}
  }
}
