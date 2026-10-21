import Foundation
import Darwin

// Native deadlines and checkpoints continue independently of the React Native JS thread.
final class SovelPlaybackState {
  private static let key = "sovel.playback.checkpoint.v1"
  private let lock = NSRecursiveLock()
  private let now: () -> Double
  private let defaults: UserDefaults
  private var token = ""
  private var lastWrite = -Double.infinity
  private var lastIndex = -1
  private var lastPlaying = false
  private var deadline: Double?
  private var total: Double = 0
  private var expired = false
  private var timer: DispatchSourceTimer?
  private var stop: (() -> Void)?
  static func onMain<T>(_ work: () -> T) -> T {
    Thread.isMainThread ? work() : DispatchQueue.main.sync(execute: work)
  }
  static func continuousSeconds() -> Double {
    var info = mach_timebase_info_data_t(); mach_timebase_info(&info)
    return Double(mach_continuous_time()) * Double(info.numer) / Double(info.denom) / 1_000_000_000
  }
  init(now: @escaping () -> Double = { continuousSeconds() }, defaults: UserDefaults = .standard) {
    self.now = now; self.defaults = defaults
  }
  static func saved() -> [String: Any] { UserDefaults.standard.dictionary(forKey: key) ?? [:] }
  func bind(_ identity: String) { lock.lock(); defer { lock.unlock() }; token = identity; lastWrite = -Double.infinity }
  func unbind() { lock.lock(); defer { lock.unlock() }; token = "" }
  func checkpoint(index: Int, position: Double, playing: Bool, force: Bool = false) {
    lock.lock(); defer { lock.unlock() }
    guard !token.isEmpty, index >= 0, position.isFinite, position >= 0 else { return }
    guard force || now() - lastWrite >= 2 || index != lastIndex || playing != lastPlaying else { return }
    defaults.set(["token": token, "index": index, "position": position], forKey: Self.key)
    lastWrite = now(); lastIndex = index; lastPlaying = playing
  }
  func start(seconds: Double, stop: @escaping () -> Void) {
    lock.lock(); defer { lock.unlock() }
    cancel(); expired = false
    guard seconds.isFinite, seconds > 0 else { return }
    total = min(seconds, 86400); deadline = now() + total; self.stop = stop
    let timer = DispatchSource.makeTimerSource(queue: .main)
    timer.schedule(deadline: .now() + min(total, 0.25), repeating: .milliseconds(250), leeway: .milliseconds(30))
    timer.setEventHandler { [weak self] in self?.check() }
    self.timer = timer; timer.resume()
  }
  func check() {
    lock.lock(); defer { lock.unlock() }
    guard let deadline, now() >= deadline else { return }
    let callback = stop
    cancel(); expired = true
    callback?()
  }
  func cancel() { lock.lock(); defer { lock.unlock() }; expired = false; timer?.cancel(); timer = nil; deadline = nil; total = 0; stop = nil }
  func status() -> [String: Any] {
    lock.lock(); defer { lock.unlock() }
    check()
    return ["available": true, "active": deadline != nil, "remaining": max(0, (deadline ?? now()) - now()), "seconds": total, "expired": expired]
  }
  deinit { timer?.cancel() }
}

// One compact snapshot per play-through. Native sampling keeps running while JS sleeps.
// The journal is acknowledged only after SQLite commits; revisions prevent double counting.
final class SovelListeningHistory {
  private static let journalLock = NSRecursiveLock()
  // Status getters can run on the JS thread while AVPlayer samples on main.
  // Protect in-memory dictionaries too, not only journal file writes.
  private let stateLock = NSRecursiveLock()
  static let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    .appendingPathComponent("SovelListeningJournal", isDirectory: true)
  private let folder: URL
  private let now: () -> Double
  private let wall: () -> Double
  private var ids: [String] = []
  private var record: [String: Any]?
  private var lastClosed: [String: Any]?
  private var ranges: [[Double]] = []
  private var anchor: (position: Double, time: Double, playing: Bool, rate: Double)?
  private var lastWrite = -Double.infinity
  private var seeking = false
  init(folder: URL = SovelListeningHistory.directory,
       now: @escaping () -> Double = { SovelPlaybackState.continuousSeconds() },
       wall: @escaping () -> Double = { Date().timeIntervalSince1970 * 1000 }) {
    self.folder = folder; self.now = now; self.wall = wall
  }
  func bind(_ trackIds: [String]) {
    stateLock.lock(); defer { stateLock.unlock() }; ids = trackIds; anchor = nil }
  func suspend() {
    stateLock.lock(); defer { stateLock.unlock() }; flush(); ids = []; anchor = nil }
  func beginSeek() {
    stateLock.lock(); defer { stateLock.unlock() };
    guard !ids.isEmpty else { return }
    if record != nil { record!["seekCount"] = (record!["seekCount"] as? Int ?? 0) + 1 }
    seeking = true; anchor = nil; flush()
  }
  func endSeek() {
    stateLock.lock(); defer { stateLock.unlock() }; seeking = false; anchor = nil }
  func sample(index: Int, position: Double, duration: Double, playing: Bool, rate: Double = 1, force: Bool = false) {
    stateLock.lock(); defer { stateLock.unlock() };
    guard ids.indices.contains(index), position.isFinite, duration.isFinite, position >= 0, !seeking else { return }
    let trackId = ids[index], clock = now()
    if let old = record, old["trackId"] as? String != trackId { finish("transition") }
    if record == nil {
      guard playing, duration <= 0 || position < duration - 0.02 else { return }
      record = ["id": UUID().uuidString, "trackId": trackId, "startedAt": wall(), "updatedAt": wall(),
                "duration": max(0, duration), "listenedSeconds": 0.0, "coveredSeconds": 0.0,
                "reason": "listening", "seekCount": 0, "revision": 0]
      ranges = []; anchor = nil; lastWrite = -Double.infinity
    }
    let changed = anchor?.playing != playing
    if let previous = anchor, previous.playing {
      let delta = position - previous.position, elapsed = clock - previous.time
      let speed = max(0.01, previous.rate)
      // A discontinuity, buffering, suspension or a seek must never fill unheard audio.
      if elapsed > 0 && elapsed <= 3 && delta > 0 && delta <= elapsed * speed + 0.35 {
        record!["listenedSeconds"] = (record!["listenedSeconds"] as? Double ?? 0) + min(elapsed, delta / speed)
        addRange(previous.position, min(position, max(0, duration)))
      }
    }
    record!["duration"] = max(0, duration)
    record!["coveredSeconds"] = min(max(0, duration), ranges.reduce(0) { $0 + max(0, $1[1] - $1[0]) })
    record!["updatedAt"] = wall(); record!["reason"] = playing ? "listening" : "paused"
    anchor = (position, clock, playing, rate.isFinite ? rate : 1)
    if force || changed || clock - lastWrite >= 5 { flush() }
  }
  private func addRange(_ start: Double, _ end: Double) {
    guard end > start else { return }
    let sorted = (ranges + [[start, end]]).sorted { $0[0] < $1[0] }
    var merged: [[Double]] = []
    for range in sorted {
      if let previous = merged.last, range[0] <= previous[1] + 0.001 {
        merged[merged.count - 1][1] = max(previous[1], range[1])
      } else { merged.append(range) }
    }
    ranges = merged
  }
  func finish(_ reason: String) {
    stateLock.lock(); defer { stateLock.unlock() };
    guard record != nil else { return }
    record!["reason"] = reason; record!["updatedAt"] = wall(); flush()
    lastClosed = record; record = nil; anchor = nil; ranges = []
  }
  func transition(index: Int, reason: String) {
    stateLock.lock(); defer { stateLock.unlock() };
    guard ids.indices.contains(index) else { return }
    let id = ids[index]
    if record?["trackId"] as? String == id { finish(reason) }
    else if var closed = lastClosed, closed["trackId"] as? String == id,
            closed["reason"] as? String == "transition", wall() - (closed["updatedAt"] as? Double ?? 0) < 2000 {
      closed["reason"] = reason; closed["revision"] = (closed["revision"] as? Int ?? 0) + 1
      persist(closed); lastClosed = closed
    }
  }
  func flush() {
    stateLock.lock(); defer { stateLock.unlock() };
    guard record != nil else { return }
    record!["revision"] = (record!["revision"] as? Int ?? 0) + 1
    persist(record!); lastWrite = now()
  }
  private func persist(_ entry: [String: Any]) {
    Self.journalLock.lock(); defer { Self.journalLock.unlock() }
    do {
      try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
      let data = try JSONSerialization.data(withJSONObject: entry)
      try data.write(to: folder.appendingPathComponent("\(entry["id"] as! String).json"), options: .atomic)
    } catch { NSLog("Sovel listening journal write failed: %@", error.localizedDescription) }
  }
  static func pending(folder: URL = directory) -> [[String: Any]] {
    journalLock.lock(); defer { journalLock.unlock() }
    let files = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
    return files.filter { $0.pathExtension == "json" }.sorted { $0.lastPathComponent < $1.lastPathComponent }.prefix(100).compactMap {
      guard let data = try? Data(contentsOf: $0) else { return nil }
      return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }
  }
  static func acknowledge(_ entries: [[String: Any]], folder: URL = directory) {
    journalLock.lock(); defer { journalLock.unlock() }
    for entry in entries {
      guard let id = entry["id"] as? String, UUID(uuidString: id) != nil,
            let revision = entry["revision"] as? NSNumber else { continue }
      let file = folder.appendingPathComponent("\(id).json")
      if let data = try? Data(contentsOf: file),
         let current = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
         current["revision"] as? NSNumber == revision { try? FileManager.default.removeItem(at: file) }
    }
  }
}
