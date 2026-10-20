import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const audio = resolve(root, "node_modules/expo-audio");
if (JSON.parse(readFileSync(resolve(audio, "package.json"))).version !== "58.0.9") throw Error("Sovel playback integration requires expo-audio 58.0.9");
function patch(file, before, after) {
  const path = resolve(audio, file), text = readFileSync(path, "utf8");
  if (text.includes(after)) return;
  if (text.split(before).length !== 2) throw Error(`Playback patch anchor changed: ${file}`);
  writeFileSync(path, text.replace(before, after));
}
copyFileSync(resolve(root, "native/playback/ios/SovelPlaybackState.swift"), resolve(audio, "ios/SovelPlaybackState.swift"));
copyFileSync(resolve(root, "native/playback/android/SovelPlaybackState.kt"), resolve(audio, "android/src/main/java/expo/modules/audio/SovelPlaybackState.kt"));
patch("ios/AudioModule.swift", '    Function("getSovelEqualizerStatus") { SovelEqualizer.status() }', '    Function("getSovelEqualizerStatus") { SovelEqualizer.status() }\n    Function("getSovelPlaybackCheckpoint") { SovelPlaybackState.saved() }');
patch("ios/AudioModule.swift", "    Class(AudioPlaylist.self) {", `    Class(AudioPlaylist.self) {
      Function("setSovelQueueToken") { (playlist: AudioPlaylist, token: String) in
        SovelPlaybackState.onMain { playlist.sovelState.bind(token); playlist.sovelCheckpoint(force: true) }
      }
      Function("flushSovelCheckpoint") { (playlist: AudioPlaylist) in SovelPlaybackState.onMain { playlist.sovelCheckpoint(force: true) } }
      Function("setSovelSleepTimer") { (playlist: AudioPlaylist, seconds: Double) in
        SovelPlaybackState.onMain { playlist.sovelState.start(seconds: seconds) { [weak playlist] in
          playlist?.wasPlaying = false
          playlist?.pause()
          playlist?.sovelCheckpoint(force: true)
        } }
      }
      Function("getSovelSleepState") { (playlist: AudioPlaylist) in SovelPlaybackState.onMain { playlist.sovelState.status() } }`);
patch("ios/AudioPlaylist.swift", "  let id = UUID().uuidString", `  let id = UUID().uuidString
  let sovelState = SovelPlaybackState()
  func sovelCheckpoint(force: Bool = false) {
    if trackCount > 0 && isLoaded {
      sovelState.checkpoint(index: currentTrackIndex, position: currentTime, playing: isPlaying, force: force)
    }
  }`);
patch("ios/AudioPlaylist.swift", "  func currentStatus() -> [String: Any] {", "  func currentStatus() -> [String: Any] {\n    sovelCheckpoint()");
patch("ios/AudioPlaylist.swift", "  func clear() {", "  func clear() {\n    sovelCheckpoint(force: true)\n    sovelState.unbind()");
patch("ios/AudioPlaylist.swift", "  func pause() {\n    ref.pause()", "  func pause() {\n    ref.pause()\n    sovelCheckpoint(force: true)");
patch("ios/AudioPlaylist.swift", "  public override func sharedObjectWillRelease() {", "  public override func sharedObjectWillRelease() {\n    sovelCheckpoint(force: true)\n    sovelState.cancel()");
const kotlin = "android/src/main/java/expo/modules/audio/";
patch(kotlin + "AudioModule.kt", '    Function("getSovelEqualizerStatus") { SovelEqualizer.status() }', '    Function("getSovelEqualizerStatus") { SovelEqualizer.status() }\n    Function("getSovelPlaybackCheckpoint") { SovelPlaybackState.saved(appContext.reactContext ?: throw IllegalStateException("No context")) }');
patch(kotlin + "AudioModule.kt", "    Class(AudioPlaylist::class) {", `    Class(AudioPlaylist::class) {
      Function("setSovelQueueToken") { playlist: AudioPlaylist, token: String -> runOnMain {
        playlist.sovelState.bind(token); playlist.sovelCheckpoint(true)
      } }
      Function("flushSovelCheckpoint") { playlist: AudioPlaylist -> runOnMain { playlist.sovelCheckpoint(true) } }
      Function("setSovelSleepTimer") { playlist: AudioPlaylist, seconds: Double -> runOnMain {
        playlist.sovelState.start(seconds) {
          playlist.isPaused = false
          playlist.ref.pause()
          playlist.sovelCheckpoint(true)
          releaseAudioFocusIfUnused()
        }
      } }
      Function("getSovelSleepState") { playlist: AudioPlaylist -> runOnMain { playlist.sovelState.status() } }`);
patch(kotlin + "AudioPlaylist.kt", "  private var currentRate = 1f", `  private var currentRate = 1f
  internal val sovelState = SovelPlaybackState(context)
  fun sovelCheckpoint(force: Boolean = false) {
    if (trackCount > 0 && ref.playbackState == Player.STATE_READY) sovelState.checkpoint(currentTrackIndex, currentTime, ref.isPlaying, force)
  }`);
patch(kotlin + "AudioPlaylist.kt", "  override fun currentStatus(): Map<String, Any?> {", "  override fun currentStatus(): Map<String, Any?> {\n    sovelCheckpoint()");
patch(kotlin + "AudioPlaylist.kt", "  fun clear() {", "  fun clear() {\n    sovelCheckpoint(true)\n    sovelState.unbind()");
patch(kotlin + "AudioPlaylist.kt", "  override fun releasePlayer() {", "  override fun releasePlayer() {\n    sovelCheckpoint(true)\n    sovelState.cancel()");
console.log("Sovel native checkpoint and sleep timer integration applied");
// History hooks are appended after the checkpoint hooks to keep both patch stages idempotent.
patch("ios/AudioModule.swift", '    Function("getSovelPlaybackCheckpoint") { SovelPlaybackState.saved() }', `    Function("getSovelPlaybackCheckpoint") { SovelPlaybackState.saved() }
    Function("getSovelListeningEvents") { SovelListeningHistory.pending() }
    Function("ackSovelListeningEvents") { (entries: [[String: Any]]) in SovelListeningHistory.acknowledge(entries) }`);
patch("ios/AudioModule.swift", '      Function("getSovelSleepState") { (playlist: AudioPlaylist) in SovelPlaybackState.onMain { playlist.sovelState.status() } }', `      Function("getSovelSleepState") { (playlist: AudioPlaylist) in SovelPlaybackState.onMain { playlist.sovelState.status() } }
      Function("bindSovelListeningQueue") { (playlist: AudioPlaylist, ids: [String]) in SovelPlaybackState.onMain { playlist.sovelHistory.bind(ids) } }
      Function("finishSovelListening") { (playlist: AudioPlaylist, reason: String) in SovelPlaybackState.onMain { playlist.sovelListen(force: true); playlist.sovelHistory.finish(reason) } }`);
patch("ios/AudioPlaylist.swift", "  private var previousTrackIndex = 0", `  let sovelHistory = SovelListeningHistory()
  func sovelListen(force: Bool = false) {
    if trackCount > 0 && isLoaded {
      sovelHistory.sample(index: currentTrackIndex, position: currentTime, duration: duration, playing: isPlaying, rate: Double(currentRate), force: force)
    }
  }
  private var previousTrackIndex = 0`);
patch("ios/AudioPlaylist.swift", "  func currentStatus() -> [String: Any] {\n    sovelCheckpoint()", "  func currentStatus() -> [String: Any] {\n    sovelCheckpoint()\n    sovelListen()");
patch("ios/AudioPlaylist.swift", "    sovelState.unbind()", "    sovelState.unbind()\n    sovelHistory.suspend()");
patch("ios/AudioPlaylist.swift", "  func pause() {\n    ref.pause()\n    sovelCheckpoint(force: true)", "  func pause() {\n    ref.pause()\n    sovelCheckpoint(force: true)\n    sovelListen(force: true)");
patch("ios/AudioPlaylist.swift", "    sovelState.cancel()", '    sovelState.cancel()\n    sovelHistory.finish("interrupted")');
patch("ios/AudioPlaylist.swift", "  private func setupPublisher() {", `  private func setupPublisher() {
    ref.publisher(for: \\.timeControlStatus).sink { [weak self] _ in self?.sovelListen(force: true) }.store(in: &cancellables)`);
patch("ios/AudioPlaylist.swift", "    if currentTrackIndex < sources.count - 1 {", '    if currentTrackIndex < sources.count - 1 {\n      sovelListen(force: true)\n      sovelHistory.transition(index: currentTrackIndex, reason: "skip")');
patch("ios/AudioPlaylist.swift", "    if currentTrackIndex > 0 {", '    if currentTrackIndex > 0 {\n      sovelListen(force: true)\n      sovelHistory.transition(index: currentTrackIndex, reason: "skip")');
patch("ios/AudioPlaylist.swift", "  func skipTo(index: Int) {\n    guard validIndex(index) else {\n      return\n    }", `  func skipTo(index: Int) {
    guard validIndex(index) else {
      return
    }
    sovelListen(force: true)
    sovelHistory.transition(index: currentTrackIndex, reason: "skip")`);
patch("ios/AudioPlaylist.swift", "  func seekTo(seconds: Double) async {", "  func seekTo(seconds: Double) async {\n    sovelListen(force: true)\n    sovelHistory.beginSeek()");
patch("ios/AudioPlaylist.swift", '          self.updateStatus(with: ["currentTime": self.currentTime])', '          self.sovelHistory.endSeek()\n          self.updateStatus(with: ["currentTime": self.currentTime])');
patch("ios/AudioPlaylist.swift", "      let isLastTrack = finishedIndex >= self.sources.count - 1", '      self.sovelHistory.transition(index: finishedIndex, reason: "completed")\n      let isLastTrack = finishedIndex >= self.sources.count - 1');
patch(kotlin + "AudioModule.kt", '    Function("getSovelPlaybackCheckpoint") { SovelPlaybackState.saved(appContext.reactContext ?: throw IllegalStateException("No context")) }', `    Function("getSovelPlaybackCheckpoint") { SovelPlaybackState.saved(appContext.reactContext ?: throw IllegalStateException("No context")) }
    Function("getSovelListeningEvents") { SovelListeningHistory.pending(appContext.reactContext ?: throw IllegalStateException("No context")) }
    Function("ackSovelListeningEvents") { entries: List<Map<String, Any>> -> SovelListeningHistory.acknowledge(appContext.reactContext ?: throw IllegalStateException("No context"), entries) }`);
patch(kotlin + "AudioModule.kt", '      Function("getSovelSleepState") { playlist: AudioPlaylist -> runOnMain { playlist.sovelState.status() } }', `      Function("getSovelSleepState") { playlist: AudioPlaylist -> runOnMain { playlist.sovelState.status() } }
      Function("bindSovelListeningQueue") { playlist: AudioPlaylist, ids: List<String> -> runOnMain { playlist.sovelHistory.bind(ids) } }
      Function("finishSovelListening") { playlist: AudioPlaylist, reason: String -> runOnMain { playlist.sovelListen(true); playlist.sovelHistory.finish(reason) } }`);
patch(kotlin + "AudioPlaylist.kt", "  private var previousMediaItemIndex = 0", `  internal val sovelHistory = SovelListeningHistory(context)
  fun sovelListen(force: Boolean = false) {
    if (trackCount > 0 && ref.playbackState == Player.STATE_READY) sovelHistory.sample(currentTrackIndex, currentTime, duration, ref.isPlaying, ref.playbackParameters.speed.toDouble(), force)
  }
  override fun onPlaybackStateUpdated(playbackState: Int, justFinished: Boolean) {
    if (justFinished) sovelHistory.transition(currentTrackIndex, "completed")
    super.onPlaybackStateUpdated(playbackState, justFinished)
  }
  private var previousMediaItemIndex = 0`);
patch(kotlin + "AudioPlaylist.kt", "  override fun currentStatus(): Map<String, Any?> {\n    sovelCheckpoint()", "  override fun currentStatus(): Map<String, Any?> {\n    sovelCheckpoint()\n    sovelListen()");
patch(kotlin + "AudioPlaylist.kt", "    sovelState.unbind()", "    sovelState.unbind()\n    sovelHistory.suspend()");
patch(kotlin + "AudioPlaylist.kt", "    sovelState.cancel()", '    sovelState.cancel()\n    sovelHistory.finish("interrupted")');
for (const method of ["next", "previous"]) {
  const available = method === "next" ? "hasNextMediaItem" : "hasPreviousMediaItem";
  patch(kotlin + "AudioPlaylist.kt", `  fun ${method}() {`, `  fun ${method}() {\n    if (ref.${available}() || (loopMode == LoopMode.ALL && trackCount > 0)) {\n      sovelListen(true)\n      sovelHistory.transition(currentTrackIndex, "skip")\n    }`);
}
patch(kotlin + "AudioPlaylist.kt", "  fun skipTo(index: Int) {\n    if (index !in 0..<trackCount) {\n      return\n    }", `  fun skipTo(index: Int) {
    if (index !in 0..<trackCount) {
      return
    }
    sovelListen(true)
    sovelHistory.transition(currentTrackIndex, "skip")`);
patch(kotlin + "AudioPlaylist.kt", "  override fun onMediaItemChanged(mediaItem: MediaItem?, reason: Int) {", `  override fun onMediaItemChanged(mediaItem: MediaItem?, reason: Int) {
    if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO || reason == Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT) sovelHistory.transition(previousMediaItemIndex, "completed")
    else if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_SEEK) sovelHistory.transition(previousMediaItemIndex, "skip")`);
patch(kotlin + "AudioPlaylist.kt", "  override fun onPlayerError(error: PlaybackException) {", '  override fun onPlayerError(error: PlaybackException) {\n    sovelHistory.finish("error")');
patch(kotlin + "BaseAudioPlayer.kt", "        if (reason == Player.DISCONTINUITY_REASON_SEEK) {", `        if (reason == Player.DISCONTINUITY_REASON_SEEK) {
          (this@BaseAudioPlayer as? AudioPlaylist)?.let { playlist ->
            if (oldPosition.mediaItemIndex == newPosition.mediaItemIndex) playlist.sovelHistory.seek()
            else playlist.sovelHistory.transition(oldPosition.mediaItemIndex, "skip")
          }`);
console.log("Sovel native listening journal integration applied");
