import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, AppState } from "react-native";
import { openDatabaseAsync } from "expo-sqlite";
import {
  setAudioModeAsync,
  useAudioPlaylist,
  useAudioPlaylistStatus,
} from "expo-audio";
import { Library } from "../core/library";
import { runScanJob } from "../core/scanJob";
import { normalizeScanRules } from "../core/scanRules";
import {
  defaults,
  playbackModes,
  type PlaybackMode,
  type Preferences,
  type Track,
  type ScanMode,
  type ScanReport,
  type SourceStatus,
  type ScanProgress,
} from "../core/types";
import * as files from "./files";
import { canPlay, supportsDsf, configureDsd } from "./playbackSupport";
import { normalizeDsd, type PcmRate } from "../core/dsd";
import { normalizeEqualizer, type EqualizerSettings } from "../core/equalizer";
import { configureEqualizer, readEqStatus } from "./equalizer";
import { normalizePreferences } from "../core/preferences";
import { normalizeLyricOffset } from "../core/lyrics";
import {
  checkpointFor,
  reorderedSessionIds,
  normalizeSession,
  restoreSession,
  type PlaybackSession,
} from "../core/playbackSession";
import {
  sleepState,
  noSleep,
  readPlaybackCheckpoint,
  listeningAvailable,
  pendingListeningEvents,
  acknowledgeListeningEvents,
  type SovelPlaylist,
} from "./playbackNative";
import type { PortableSettings } from "../core/settingsBackup";
import { emptyProfile, type ListeningEntry } from "../core/listeningHistory";
import {
  addQueueSources,
  FavoriteUpdates,
  samePlaybackSources,
} from "../core/playbackRequests";
function shuffleTracks(list: Track[]) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function useStore() {
  const [tracks, setTracks] = useState<Track[]>([]),
    [prefs, setPrefs] = useState<Preferences>(defaults);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState("");
  const [report, setReport] = useState<ScanReport | null>(null),
    [error, setError] = useState("");
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const originalQueue = useRef<Track[]>([]),
    queueRevision = useRef(0);
  const prefsRef = useRef(defaults),
    prefWrites = useRef(Promise.resolve());
  const activeSession = useRef<PlaybackSession | null>(null),
    queueRef = useRef<Track[]>([]);
  const transitioning = useRef(false);
  const intendedPlaying = useRef<boolean | null>(null);
  const [controlIntent, setControlIntent] = useState<boolean | null>(null);
  const favoriteUpdates = useRef(new FavoriteUpdates());
  const favoriteValues = useRef(new Map<string, boolean>());
  const loadingQueue = useRef<Track[]>([]);
  const loadingSession = useRef<{
    snapshot: PlaybackSession;
    original: Track[];
  } | null>(null);
  const [pendingTrack, setPendingTrack] = useState<Track | null>(null);
  const [restoreNote, setRestoreNote] = useState("");
  const [lyricOffsets, setLyricOffsets] = useState<Record<string, number>>({});
  const [nativeSleep, setNativeSleep] = useState(noSleep);
  const [eqStatus, setEqStatus] = useState(readEqStatus);
  const eqSettings = useRef(defaults.equalizer);
  const sleepEnd = nativeSleep.active
    ? Date.now() + nativeSleep.remaining * 1000
    : null;
  const sleepRemaining = Math.ceil(nativeSleep.remaining / 60);
  const sleepMinutes = nativeSleep.seconds / 60;
  const shuffle = prefs.playbackMode === "shuffle";
  const library = useRef<Library | null>(null),
    abort = useRef<AbortController | null>(null),
    operation = useRef(false);
  const playlist = useAudioPlaylist({
    sources: [],
    loop: "all",
    updateInterval: 300,
  });
  const status = useAudioPlaylistStatus(playlist);
  useEffect(() => {
    let previous: string | undefined;
    const subscription = playlist.addListener(
      "playlistStatusUpdate",
      (value) => {
        const failure = (value as typeof value & { sovelError?: string })
          .sovelError;
        if (failure && failure !== previous) setError(`播放失败：${failure}`);
        if (
          failure ||
          (!transitioning.current && value.playing === intendedPlaying.current)
        ) {
          intendedPlaying.current = null;
          setControlIntent(null);
        }
        previous = failure;
      },
    );
    return () => subscription.remove();
  }, [playlist]);
  const nativePlaylist = playlist as SovelPlaylist;
  const current =
    pendingTrack ||
    queue[status.currentIndex] ||
    tracks.find((t) => t.id === prefs.lastTrack) ||
    tracks.find(canPlay) ||
    tracks[0];
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [listeningHistory, setListeningHistory] = useState<ListeningEntry[]>(
    [],
  );
  const [listeningSummary, setListeningSummary] = useState({
    plays: 0,
    seconds: 0,
    completed: 0,
  });
  const [listeningProfile, setListeningProfile] = useState(emptyProfile);
  const drainingHistory = useRef(false);
  const historyLimit = useRef(60);
  const refreshListening = useCallback(async () => {
    const history = library.current?.history;
    if (!history || drainingHistory.current) return;
    drainingHistory.current = true;
    try {
      // Drain bounded batches; a long offline session doesn't make one bridge call enormous.
      for (let batch = 0; batch < 10; batch++) {
        const events = pendingListeningEvents();
        if (!events.length) break;
        const accepted = await history.ingest(events);
        acknowledgeListeningEvents(accepted);
        if (!accepted.length || events.length < 100) break;
      }
      const [recent, summary, profile] = await Promise.all([
        history.recent(historyLimit.current),
        history.summary(),
        history.profile(),
      ]);
      setListeningHistory(recent);
      setListeningSummary(summary);
      setListeningProfile(profile);
    } catch (e) {
      setError(`听歌记录保存失败：${String(e)}`);
    } finally {
      drainingHistory.current = false;
    }
  }, []);
  const loadMoreListening = async () => {
    historyLimit.current += 60;
    await refreshListening();
  };
  const refresh = async () => {
    const all = await library.current!.list();
    const visible = all.map((t) => ({
      ...t,
      available: t.available && !files.sourceStatus(t.sourceId)?.error,
    }));
    setTracks(visible);
    return visible;
  };
  const restoreSources = async () => {
    const restored: SourceStatus[] = [];
    for (const source of await library.current!.sources()) {
      const active = await files.activate(source);
      restored.push(active);
      if (!active.error) await library.current!.saveSource(active);
    }
    setSources(restored);
    return restored;
  };
  useEffect(() => {
    let alive = true;
    (async () => {
      files.prepareFiles();
      const db = await openDatabaseAsync("sovel.db");
      const lib = new Library(db);
      await lib.init();
      const saved = normalizePreferences(
        await lib.get("preferences", defaults),
      );
      eqSettings.current = normalizeEqualizer(saved.equalizer);
      if (readEqStatus().available) configureEqualizer(eqSettings.current);
      if (supportsDsf) configureDsd(saved.dsd);
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground:
          saved.backgroundPlayback ?? defaults.backgroundPlayback,
        interruptionMode: "doNotMix",
      });
      if (!alive) return;
      library.current = lib;
      await restoreSources();
      const all = await refresh();
      prefsRef.current = saved;
      setPrefs(saved);
      setLyricOffsets(await lib.lyricOffsets());
      await refreshListening();
      const session = normalizeSession(await lib.get("playbackSession", null));
      if (session) {
        activeSession.current = session;
        const restored = restoreSession(
          session,
          all,
          checkpointFor(
            session,
            readPlaybackCheckpoint(),
            await lib.get("playbackCheckpoint", null),
          ),
          canPlay,
        );
        if (restored.current) {
          await installQueue(
            restored.ordered,
            restored.current,
            restored.position,
            false,
            restored.original,
            session.queueIds,
            session.originalIds,
            saved.playbackMode,
          );
        }
        if (restored.unavailable)
          setRestoreNote(
            `${restored.unavailable} 首暂时不可用，已保留队列记录`,
          );
      }
      setNativeSleep(sleepState(nativePlaylist));
      setReport(await lib.get("lastScan", null));
      setReady(true);
    })().catch((e) => setError(String(e)));
    return () => {
      alive = false;
    };
  }, []);
  const preferences = (patch: Partial<Preferences>) => {
    const next = normalizePreferences({ ...prefsRef.current, ...patch });
    prefsRef.current = next;
    setPrefs(next);
    const write = prefWrites.current
      .catch(() => {})
      .then(() => library.current?.set("preferences", next));
    prefWrites.current = write;
    write.catch((e) => setError(String(e)));
    return write;
  };
  const savePlayback = async () => {
    if (
      transitioning.current ||
      !activeSession.current ||
      !queueRef.current.length
    )
      return;
    const actual = playlist.currentStatus;
    const track = queueRef.current[actual.currentIndex];
    if (!track || !actual.isLoaded) return;
    const snapshot = {
      ...activeSession.current,
      currentId: track.id,
      position: Math.max(0, actual.currentTime),
      mode: prefsRef.current.playbackMode,
    };
    activeSession.current = snapshot;
    // Queue membership is persisted only when it changes; this write stays constant-sized.
    await library.current?.set("playbackCheckpoint", {
      token: snapshot.token,
      index: actual.currentIndex,
      position: snapshot.position,
    });
    nativePlaylist.flushSovelCheckpoint?.();
  };
  const seek = async (seconds: number) => {
    if (transitioning.current || !Number.isFinite(seconds)) return;
    try {
      await playlist.seekTo(Math.max(0, seconds));
      await savePlayback();
    } catch (e) {
      setError(String(e));
    }
  };
  const setLyricOffset = async (seconds: number) => {
    if (!current) return;
    const value = normalizeLyricOffset(seconds),
      id = current.id;
    try {
      await library.current!.setLyricOffset(id, value);
      setLyricOffsets((previous) => ({ ...previous, [id]: value }));
    } catch (e) {
      setError(String(e));
    }
  };
  async function installQueue(
    ordered: Track[],
    track: Track,
    time: number,
    playing: boolean,
    original: Track[],
    queueIds = ordered.map((t) => t.id),
    originalIds = original.map((t) => t.id),
    mode = prefsRef.current.playbackMode,
    reuse = false,
  ) {
    const timerAtStart = sleepState(nativePlaylist);
    const revision = ++queueRevision.current;
    const snapshot: PlaybackSession = {
      version: 1,
      token: `${Date.now()}-${revision}-${Math.random().toString(36).slice(2)}`,
      queueIds,
      originalIds,
      nativeIds: ordered.map((t) => t.id),
      currentId: track.id,
      position: time,
      mode,
    };
    transitioning.current = true;
    loadingQueue.current = ordered;
    loadingSession.current = { snapshot, original };
    intendedPlaying.current = playing;
    setControlIntent(playing);
    setPendingTrack(track);
    setError("");
    try {
      const audio = ordered.map((t) => ({
        uri: files.trackUri(t),
        name: t.title,
      }));
      playlist.pause();
      await library.current!.set("playbackSession", snapshot);
      if (revision !== queueRevision.current) return;
      if (!reuse) {
        playlist.clear();
        if (
          !(await addQueueSources(
            audio,
            (source) => playlist.add(source),
            () => revision === queueRevision.current,
          ))
        )
          return;
      }
      // A favorite tap may have happened while this queue was being installed.
      const latestFavorite = (item: Track) =>
        favoriteValues.current.has(item.id)
          ? { ...item, favorite: favoriteValues.current.get(item.id)! }
          : item;
      queueRef.current = ordered.map(latestFavorite);
      setQueue(queueRef.current);
      originalQueue.current = original.map(latestFavorite);
      activeSession.current = snapshot;
      playlist.loop = mode === "single" ? "single" : "all";
      playlist.skipTo(ordered.findIndex((t) => t.id === track.id));
      nativePlaylist.setSovelQueueToken?.(snapshot.token);
      nativePlaylist.bindSovelListeningQueue?.(snapshot.nativeIds);
      // Start buffering/playback immediately when no position restore is needed.
      if (
        time === 0 &&
        intendedPlaying.current &&
        !(timerAtStart.active && sleepState(nativePlaylist).expired)
      )
        playlist.play();
      const deadline = Date.now() + 12000;
      while (
        !playlist.isLoaded &&
        Date.now() < deadline &&
        revision === queueRevision.current
      ) {
        const failure = (
          playlist.currentStatus as typeof status & { sovelError?: string }
        ).sovelError;
        if (failure) throw new Error(`播放失败：${failure}`);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (revision !== queueRevision.current) return;
      if (!playlist.isLoaded)
        throw new Error("无法恢复播放位置，请检查文件是否在线及编码是否受支持");
      if (time > 0)
        await playlist.seekTo(
          Math.min(
            time,
            playlist.duration > 0
              ? Math.max(0, playlist.duration - 0.05)
              : time,
          ),
        );
      if (revision !== queueRevision.current) return;
      if (
        intendedPlaying.current &&
        !(timerAtStart.active && sleepState(nativePlaylist).expired)
      ) {
        playlist.play();
      } else {
        intendedPlaying.current = false;
        setControlIntent(false);
        playlist.pause();
      }
    } catch (e) {
      if (revision === queueRevision.current) {
        intendedPlaying.current = false;
        setControlIntent(false);
        playlist.pause();
        setError(String(e));
      }
    } finally {
      if (revision === queueRevision.current) {
        transitioning.current = false;
        setPendingTrack(null);
      }
    }
  }
  const restoreSettings = async (settings: PortableSettings) => {
    const previous = prefsRef.current;
    const next = normalizePreferences({
      ...settings,
      lastTrack: previous.lastTrack,
    });
    if (next.equalizer.enabled && !readEqStatus().available)
      throw new Error("请安装新版应用后再恢复已开启的均衡器");
    // Validate first; apply native side effects before committing the settings document.
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: next.backgroundPlayback,
        interruptionMode: "doNotMix",
      });
      if (readEqStatus().available) configureEqualizer(next.equalizer);
      if (supportsDsf) configureDsd(next.dsd);
      await prefWrites.current.catch(() => {});
      await library.current!.set("preferences", next);
      eqSettings.current = next.equalizer;
      prefsRef.current = next;
      setPrefs(next);
      if (previous.playbackMode !== next.playbackMode)
        await reorderMode(next.playbackMode);
      else if (previous.dsd.pcmRate !== next.dsd.pcmRate)
        await reloadAudioQueue();
    } catch (e) {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: previous.backgroundPlayback,
        interruptionMode: "doNotMix",
      });
      if (readEqStatus().available) configureEqualizer(previous.equalizer);
      if (supportsDsf) configureDsd(previous.dsd);
      throw e;
    }
  };
  const setBackgroundPlayback = async (enabled: boolean) => {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: enabled,
        interruptionMode: "doNotMix",
      });
      await preferences({ backgroundPlayback: enabled });
    } catch (e) {
      setError(String(e));
    }
  };
  const setEqualizer = (
    update: (previous: EqualizerSettings) => EqualizerSettings,
  ) => {
    try {
      const next = normalizeEqualizer(update(eqSettings.current));
      // Configure before persisting: a failed native call must not show as enabled.
      if (readEqStatus().available) configureEqualizer(next);
      else if (next.enabled) throw new Error("请安装包含均衡器模块的新版应用");
      eqSettings.current = next;
      void preferences({ equalizer: next });
      setEqStatus(readEqStatus());
    } catch (e) {
      setError(String(e));
    }
  };
  async function reloadAudioQueue() {
    const state = playlist.currentStatus;
    const track = queueRef.current[state.currentIndex];
    if (!track || !activeSession.current) return;
    await installQueue(
      queueRef.current,
      track,
      state.currentTime,
      state.playing,
      originalQueue.current,
      activeSession.current.queueIds,
      activeSession.current.originalIds,
    );
  }
  const setDsdRate = async (pcmRate: PcmRate) => {
    if (transitioning.current || pcmRate === prefsRef.current.dsd.pcmRate)
      return;
    try {
      const next = normalizeDsd({ pcmRate });
      configureDsd(next);
      await preferences({ dsd: next });
      // Recreate sources so already-buffered DSF tracks also use the new rate.
      await reloadAudioQueue();
    } catch (e) {
      setError(String(e));
    }
  };
  useEffect(() => {
    const timer = setInterval(() => setEqStatus(readEqStatus()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    playlist.loop = prefs.playbackMode === "single" ? "single" : "all";
  }, [playlist, prefs.playbackMode]);
  const pause = () => {
    intendedPlaying.current = false;
    setControlIntent(false);
    playlist.pause();
    void savePlayback().catch((e) => setError(String(e)));
  };
  const checkSleep = () => setNativeSleep(sleepState(nativePlaylist));
  const setSleepTimer = (minutes: number) => {
    try {
      if (!nativePlaylist.setSovelSleepTimer)
        throw new Error("请安装包含原生定时器的新版应用");
      nativePlaylist.setSovelSleepTimer(
        Math.max(0, Math.min(1440, minutes)) * 60,
      );
      checkSleep();
    } catch (e) {
      setError(String(e));
    }
  };
  useEffect(() => {
    const timer = setInterval(() => {
      checkSleep();
    }, 1000);
    return () => clearInterval(timer);
  }, [playlist]);
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => {
      void savePlayback().catch((e) => setError(String(e)));
    }, 2000);
    return () => clearInterval(timer);
  }, [ready, playlist]);
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => {
      if (pendingListeningEvents().length) void refreshListening();
    }, 10000);
    const listener = AppState.addEventListener("change", (next) => {
      if (next === "active") void refreshListening();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [ready, refreshListening]);
  useEffect(() => {
    let wasBackground = AppState.currentState === "background";
    const listener = AppState.addEventListener("change", (next) => {
      checkSleep();
      void savePlayback().catch((e) => setError(String(e)));
      if (
        !prefs.backgroundPlayback &&
        (next === "background" || (next === "active" && wasBackground))
      ) {
        // expo-audio resumes background-paused players on foreground. Keep
        // our explicit preference paused until the user presses play again.
        pause();
      }
      if (next === "background") wasBackground = true;
      if (next === "active") wasBackground = false;
    });
    return () => listener.remove();
  }, [prefs.backgroundPlayback, playlist]);
  useEffect(() => {
    if (!current || !queue.length || transitioning.current) return;
    playlist.setActiveForLockScreen(prefs.backgroundPlayback, {
      title: current.title,
      artist: current.artist,
      albumTitle: current.album,
      artworkUrl: files.artUri(current.artwork),
    });
    preferences({ lastTrack: current.id });
    // Index is owned by the native queue, including lockscreen next/previous.
  }, [current?.id, queue.length, prefs.backgroundPlayback, pendingTrack]);
  useEffect(() => {
    if (!queue.length || status.isLoaded) return;
    const timer = setTimeout(() => {
      playlist.pause();
      setError(
        "系统暂时无法打开这首音频，请检查来源是否在线、文件是否完整或编码是否受支持。",
      );
    }, 15000);
    return () => clearTimeout(timer);
  }, [queue, current?.id, status.isLoaded]);
  const run = async (work: () => Promise<void>) => {
    if (operation.current || !ready) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      operation.current = false;
      setBusy(false);
      setProgress("");
      abort.current = null;
    }
  };
  const scanWork = async (mode: ScanMode, only?: string[]) => {
    abort.current = new AbortController();
    const rules = normalizeScanRules(prefs.scanRules);
    setScanProgress({
      phase: "preparing",
      source: "",
      sourceIndex: 0,
      sourceCount: 0,
      done: 0,
      total: null,
      path: "",
    });
    setProgress("正在读取音乐来源…");
    try {
      const active = await restoreSources();
      let lastUpdate = 0;
      let lastPhase = "";
      const aggregate = await runScanJob({
        library: library.current!,
        sources: active.filter((source) => !only || only.includes(source.id)),
        mode,
        rules,
        signal: abort.current.signal,
        enumerate: (source, found) =>
          files.enumerate(source, abort.current?.signal, rules, found),
        parse: (entry, source) => files.parseFile(entry, source.id),
        progress: (value) => {
          const now = Date.now();
          if (
            value.phase === lastPhase &&
            value.done !== 0 &&
            value.done !== value.total &&
            now - lastUpdate < 100
          )
            return;
          lastUpdate = now;
          lastPhase = value.phase;
          setScanProgress(value);
          setProgress(
            value.total === null
              ? `正在扫描 · 已发现 ${value.done} 个音频文件`
              : `正在导入 ${value.done} / ${value.total} · ${value.path.split("/").pop() || value.source}`,
          );
        },
        sourceError: (source, error) => {
          files.markUnavailable(source.id, String(error));
          setSources((previous) =>
            previous.map((item) =>
              item.id === source.id ? { ...item, error: String(error) } : item,
            ),
          );
        },
      });
      setReport(aggregate);
      await library.current!.set("lastScan", aggregate);
      setScanProgress(
        (previous) => previous && { ...previous, phase: "complete", path: "" },
      );
    } catch (e) {
      setScanProgress(
        (previous) =>
          previous && {
            ...previous,
            phase: abort.current?.signal.aborted ? "cancelled" : "failed",
          },
      );
      throw e;
    } finally {
      await refresh();
    }
  };
  const scan = (mode: ScanMode) => run(() => scanWork(mode));
  const addSources = (kind: "files" | "folder") =>
    run(async () => {
      setProgress("请选择音乐来源，授权后再开始扫描");
      const selected = await files.selectSources(kind === "folder");
      for (const source of selected) await library.current!.saveSource(source);
      await restoreSources();
    });
  const importMusic = (kind: "files" | "folder" | "copy") =>
    run(async () => {
      setProgress(
        kind === "copy"
          ? "选择要复制到应用的音乐"
          : "请选择音乐来源，直接索引原文件",
      );
      if (kind === "files" || kind === "folder") {
        const selected = await files.selectSources(kind === "folder");
        if (!selected.length) return;
        const ids: string[] = [];
        for (const source of selected)
          ids.push((await library.current!.saveSource(source)).id);
        await scanWork("incremental", ids);
      } else {
        if (!(await files.copySelectedFiles())) return;
        await scanWork("incremental", ["local"]);
      }
    });
  const play = (track: Track, list = tracks) => {
    if (!canPlay(track)) {
      Alert.alert(
        "暂时无法播放",
        track.available
          ? ["DSF", "DFF"].includes(track.format.toUpperCase())
            ? track.format.toUpperCase() === "DSF"
              ? "当前安装包未包含 DSF 软解模块。Android 请安装新版完整应用；iOS 暂时支持读取标签、封面和歌词。"
              : "DFF 暂时支持读取标签，音频解码尚未接入。DSF 软解不适用于 DFF 文件。"
            : "此格式已加入曲库，专用解码模块尚未接入。当前可试听 FLAC、PCM WAV、MP3、AAC 等系统支持的文件。"
          : "文件或来源暂时不可用，请连接设备后扫描，或重新授权。",
      );
      return;
    }
    nativePlaylist.finishSovelListening?.(
      track.id === current?.id ? "replay" : "selected",
    );
    const playable = list.filter(canPlay),
      pool = playable.some((t) => t.id === track.id) ? playable : [track];
    const reuse =
      !transitioning.current &&
      playlist.isLoaded &&
      samePlaybackSources(pool, originalQueue.current) &&
      queueRef.current.some((item) => item.id === track.id);
    if (reuse) {
      setRestoreNote("");
      void installQueue(
        queueRef.current,
        track,
        0,
        true,
        pool,
        activeSession.current?.queueIds,
        activeSession.current?.originalIds,
        prefsRef.current.playbackMode,
        true,
      );
      return;
    }
    const ordered = shuffle
      ? [track, ...shuffleTracks(pool.filter((t) => t.id !== track.id))]
      : pool;
    setRestoreNote("");
    void installQueue(ordered, track, 0, true, pool);
  };
  const toggle = () => {
    if (!current) return;
    if (transitioning.current) {
      const next = !intendedPlaying.current;
      intendedPlaying.current = next;
      setControlIntent(next);
      if (!next) playlist.pause();
      return;
    }
    if (!queue.length) play(current);
    else if (intendedPlaying.current ?? playlist.playing) pause();
    else {
      intendedPlaying.current = true;
      setControlIntent(true);
      playlist.play();
    }
  };
  const resume = () => {
    if (!current) return;
    if (transitioning.current) {
      intendedPlaying.current = true;
      setControlIntent(true);
      return;
    }
    if (!queue.length) play(current);
    else {
      intendedPlaying.current = true;
      setControlIntent(true);
      playlist.play();
    }
  };
  const skipTrack = (delta: number) => {
    if (transitioning.current) {
      const ordered = loadingQueue.current;
      const loading = loadingSession.current;
      const index = ordered.findIndex(
        (t) => t.id === loading?.snapshot.currentId,
      );
      if (ordered.length && loading)
        void installQueue(
          ordered,
          ordered[
            (Math.max(0, index) + delta + ordered.length) % ordered.length
          ],
          0,
          intendedPlaying.current ?? true,
          loading.original,
          loading.snapshot.queueIds,
          loading.snapshot.originalIds,
          loading.snapshot.mode,
        );
      return;
    }
    if (!queue.length) return;
    playlist.skipTo(
      (playlist.currentIndex + delta + queue.length) % queue.length,
    );
  };
  const favorite = (track: Track) =>
    favoriteUpdates.current.toggle(
      track.id,
      track.favorite,
      (value) => {
        favoriteValues.current.set(track.id, value);
        const update = (t: Track) =>
          t.id === track.id ? { ...t, favorite: value } : t;
        setTracks((all) => all.map(update));
        queueRef.current = queueRef.current.map(update);
        originalQueue.current = originalQueue.current.map(update);
        loadingQueue.current = loadingQueue.current.map(update);
        setQueue(queueRef.current);
        setPendingTrack((pending) => (pending ? update(pending) : null));
      },
      async (value) => {
        await library.current!.favorite(track.id, value);
      },
      (e) => setError(`收藏保存失败：${String(e)}`),
    );
  const reorderMode = async (mode: PlaybackMode) => {
    playlist.loop = mode === "single" ? "single" : "all";
    const now = queueRef.current[playlist.currentIndex];
    if (!now || transitioning.current) return;
    const byId = new Map(queueRef.current.map((t) => [t.id, t]));
    const ordered =
      mode === "shuffle"
        ? [
            now,
            ...shuffleTracks(queueRef.current.filter((t) => t.id !== now.id)),
          ]
        : originalQueue.current.map((t) => byId.get(t.id) || t).filter(canPlay);
    const ids = activeSession.current
      ? reorderedSessionIds(
          activeSession.current,
          ordered.map((t) => t.id),
          mode === "shuffle",
        )
      : undefined;
    await installQueue(
      ordered,
      now,
      playlist.currentTime,
      playlist.playing,
      originalQueue.current,
      ids?.queueIds,
      ids?.originalIds,
    );
  };
  const setPlaybackMode = async (mode: PlaybackMode) => {
    const previous = prefsRef.current.playbackMode;
    if (mode === previous || transitioning.current) return;
    try {
      await preferences({ playbackMode: mode });
      playlist.loop = mode === "single" ? "single" : "all";
      if ((previous === "shuffle") !== (mode === "shuffle"))
        await reorderMode(mode);
      else await savePlayback();
    } catch (e) {
      setError(String(e));
    }
  };
  const cyclePlaybackMode = () => {
    const modes = Object.keys(playbackModes) as PlaybackMode[];
    setPlaybackMode(
      modes[(modes.indexOf(prefs.playbackMode) + 1) % modes.length],
    );
  };
  return {
    ready,
    tracks,
    prefs,
    preferences,
    current,
    queue,
    playlist,
    status,
    controlPlaying: controlIntent ?? status.playing,
    playbackLoading: !!pendingTrack || status.isBuffering,
    setPlaybackMode,
    cyclePlaybackMode,
    setBackgroundPlayback,
    eqStatus,
    setEqualizer,
    setDsdRate,
    restoreSettings,
    listeningAvailable: listeningAvailable(),
    listeningHistory,
    listeningSummary,
    listeningProfile,
    refreshListening,
    loadMoreListening,
    seek,
    resume,
    restoreNote,
    lyricOffset: current ? lyricOffsets[current.id] || 0 : 0,
    setLyricOffset,
    nativeSleep,
    sleepEnd,
    sleepRemaining,
    sleepMinutes,
    setSleepTimer,
    play,
    toggle,
    skipTrack,
    favorite,
    busy,
    progress,
    scanProgress,
    report,
    error,
    setError,
    scan,
    importMusic,
    addSources,
    cancel: () => abort.current?.abort(),
    sources,
  };
}
type Store = ReturnType<typeof useStore>;
const Context = createContext<Store | null>(null);
export function MusicProvider({ children }: { children: React.ReactNode }) {
  const store = useStore();
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useMusic() {
  return useContext(Context)!;
}
