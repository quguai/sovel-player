import Foundation

func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
  guard condition() else { fatalError(message) }
}
let suite = "sovel.playback.test.\(UUID().uuidString)"
let defaults = UserDefaults(suiteName: suite)!
defer { defaults.removePersistentDomain(forName: suite) }
var time: Double = 100
let state = SovelPlaybackState(now: {time}, defaults: defaults)
state.bind("queue-a")
state.checkpoint(index: 1, position: 7, playing: true)
state.checkpoint(index: 1, position: 8, playing: true)
expect(defaults.dictionary(forKey: "sovel.playback.checkpoint.v1")?["position"] as? Double == 7, "throttle")
state.checkpoint(index: 2, position: 0, playing: true)
expect(defaults.dictionary(forKey: "sovel.playback.checkpoint.v1")?["index"] as? Int == 2, "native track change")
state.unbind(); state.checkpoint(index: 0, position: 0, playing: false, force: true)
expect(defaults.dictionary(forKey: "sovel.playback.checkpoint.v1")?["index"] as? Int == 2, "clear must not overwrite old queue")
var stops = 0
state.start(seconds: 60) { stops += 1 }
time = 159; state.check(); expect(stops == 0, "not early")
time = 170; state.check(); state.check(); expect(stops == 1, "deadline fires once after suspension")
expect(state.status()["active"] as? Bool == false, "expired inactive")
state.start(seconds: 60) { stops += 1 }; state.cancel(); time += 100; state.check()
expect(stops == 1, "cancelled timer does not fire")
let nativeTimer = SovelPlaybackState()
var didStop = false
nativeTimer.start(seconds: 0.1) { didStop = true }
// No JS or status polling: the native dispatch source must stop on its own.
RunLoop.main.run(until: Date().addingTimeInterval(0.5))
expect(didStop, "native timer must fire independently")
print("Native checkpoint/deadline/cancel/independent dispatch checks passed")

let historyFolder = FileManager.default.temporaryDirectory.appendingPathComponent("sovel-history-\(UUID().uuidString)")
defer { try? FileManager.default.removeItem(at: historyFolder) }
var tick = 0.0
let history = SovelListeningHistory(folder: historyFolder, now: { tick }, wall: { 100000 + tick * 1000 })
history.bind(["one", "two"])
func sample(_ position: Double, _ playing: Bool = true) {
  history.sample(index: 0, position: position, duration: 100, playing: playing, force: true)
}
func event() -> [String: Any] { SovelListeningHistory.pending(folder: historyFolder)[0] }
sample(0); tick = 1; sample(1)
expect(event()["coveredSeconds"] as? Double == 1, "real progress is covered")
history.beginSeek(); history.endSeek(); tick = 2; sample(51); tick = 3; sample(52)
expect(event()["coveredSeconds"] as? Double == 2, "seek gap must not be credited")
tick = 4; sample(53, false); tick = 104; sample(53, false)
expect(event()["listenedSeconds"] as? Double == 3, "pause is not listening time")
sample(53); tick = 105; sample(54)
history.beginSeek(); history.endSeek(); sample(0); tick = 106; sample(1)
expect(event()["coveredSeconds"] as? Double == 4, "repeated ranges count once for completion")
expect(event()["listenedSeconds"] as? Double == 5, "repeated ranges still count listening time")
let oldEvent = event(); tick = 107; sample(2)
SovelListeningHistory.acknowledge([oldEvent], folder: historyFolder)
expect(!SovelListeningHistory.pending(folder: historyFolder).isEmpty, "stale ack cannot delete newer progress")
history.transition(index: 0, reason: "skip")
expect(event()["reason"] as? String == "skip", "explicit skip classified")
SovelListeningHistory.acknowledge([event()], folder: historyFolder)
expect(SovelListeningHistory.pending(folder: historyFolder).isEmpty, "committed revision acknowledged")
// Large scheduling gaps are conservatively excluded instead of inflating completion.
sample(0); tick += 20; sample(20)
expect(event()["coveredSeconds"] as? Double == 0, "suspension must not invent listening")
history.finish("completed")
let completedId = event()["id"] as? String
sample(100)
expect(SovelListeningHistory.pending(folder: historyFolder).count == 1, "end callback cannot create a phantom play")
sample(0); tick += 1; sample(1)
expect(SovelListeningHistory.pending(folder: historyFolder).contains { $0["id"] as? String != completedId }, "repeat starts a separate play-through")
print("Native listening: seek/pause/coverage/repeat/revision journal checks passed")

// Reproduce concurrent JS status reads, AVPlayer ticks and transport controls.
let concurrentFolder = FileManager.default.temporaryDirectory.appendingPathComponent("sovel-history-concurrent-\(UUID().uuidString)")
defer { try? FileManager.default.removeItem(at: concurrentFolder) }
let concurrentHistory = SovelListeningHistory(folder: concurrentFolder)
concurrentHistory.bind(["one", "two"])
DispatchQueue.concurrentPerform(iterations: 400) { i in
  switch i % 7 {
  case 0: concurrentHistory.bind(["one", "two"])
  case 1: concurrentHistory.beginSeek(); concurrentHistory.endSeek()
  case 2: concurrentHistory.transition(index: i % 2, reason: "skip")
  case 3: concurrentHistory.finish("selected")
  default: concurrentHistory.sample(index: i % 2, position: Double(i % 90), duration: 100, playing: true, force: true)
  }
}
concurrentHistory.endSeek()
concurrentHistory.sample(index: 0, position: 1, duration: 100, playing: true, force: true)
concurrentHistory.finish("paused")
let concurrentEvents = SovelListeningHistory.pending(folder: concurrentFolder)
expect(!concurrentEvents.isEmpty, "concurrent updates must retain readable journal events")
for event in concurrentEvents {
  expect((event["coveredSeconds"] as? Double ?? -1) >= 0, "valid concurrent coverage")
  expect((event["coveredSeconds"] as? Double ?? 101) <= 100, "bounded concurrent coverage")
}
print("Native listening: concurrent sampling/seek/finish/bind checks passed")
