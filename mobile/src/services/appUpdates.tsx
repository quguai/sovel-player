import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Linking, Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import config from "../../app.json";
import { useMusic } from "./store";
import {
  defaultUpdatePreferences,
  normalizeUpdatePreferences,
  findUpdate,
  parseUpdatePackage,
  releaseVersion,
  repositoryName,
  type Release,
  type UpdatePackage,
  type UpdatePreferences,
} from "../core/appUpdates";

type DownloadState = {
  phase: "idle" | "downloading" | "verifying" | "ready" | "cancelled" | "error";
  received: number;
  total: number;
  error?: string;
  sha256?: string;
  versionCode?: number;
};
type AppInfo = { version: string; code: number; packageId: string };
const native = requireOptionalNativeModule<{
  appInfo(): AppInfo;
  isWifi(): boolean;
  downloadState(): DownloadState;
  cancelDownload(): void;
  download(
    url: string,
    hash: string,
    size: number,
    code: number,
    wifiOnly: boolean,
  ): Promise<void>;
  install(): Promise<"permission" | "installer">;
}>("SovelUpdates");
const extra = config.expo.extra as {
  githubRepository: string;
  distribution?: string;
};
export const updateRepository = repositoryName(extra.githubRepository);
export const installedApp = native?.appInfo() || {
  version: config.expo.version,
  code: releaseVersion(config.expo.version)?.code || 1,
  packageId: config.expo.android.package,
};
export const canInstallUpdates =
  Platform.OS === "android" && !!native && extra.distribution === "github";
const emptyDownload: DownloadState = { phase: "idle", received: 0, total: 0 };
const checkInterval = 12 * 60 * 60 * 1000;
async function jsonResponse(url: string, maxBytes: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    if (response.status === 404 && url.startsWith("https://api.github.com/"))
      throw new Error("无法访问更新仓库，请确认仓库已公开或稍后重试");
    if (!response.ok)
      throw new Error(
        response.status === 403 || response.status === 429
          ? "检查过于频繁，请稍后再试"
          : `无法获取版本信息（${response.status}）`,
      );
    const text = await response.text();
    if (text.length > maxBytes) throw new Error("版本信息过大，已停止读取");
    return JSON.parse(text) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

function useUpdateStore() {
  const { ready } = useMusic();
  const [prefs, setPrefs] = useState(defaultUpdatePreferences);
  const [loaded, setLoaded] = useState(false);
  const [release, setRelease] = useState<Release | null>(null);
  const [packageInfo, setPackage] = useState<UpdatePackage | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const installInProgress = useRef(false);
  const [download, setDownload] = useState<DownloadState>(emptyDownload);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const db = useRef<SQLiteDatabase | null>(null);
  const prefsRef = useRef(prefs);
  const checkingRef = useRef(false);
  const downloading = useRef(false);
  const writes = useRef(Promise.resolve());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    void (async () => {
      try {
        const connection = await openDatabaseAsync("sovel.db");
        const saved = await connection.getFirstAsync<{ value: string }>(
          "SELECT value FROM preferences WHERE key=?",
          "appUpdates",
        );
        const next = normalizeUpdatePreferences(
          saved ? JSON.parse(saved.value) : null,
        );
        if (disposed) return;
        db.current = connection;
        prefsRef.current = next;
        setPrefs(next);
        setLoaded(true);
      } catch {
        if (!disposed) {
          setMessage("无法读取更新设置，请重新打开应用");
          setHasError(true);
        }
      }
    })();
    return () => {
      disposed = true;
    };
  }, [ready]);
  const preferences = useCallback(async (patch: Partial<UpdatePreferences>) => {
    const next = normalizeUpdatePreferences({ ...prefsRef.current, ...patch });
    prefsRef.current = next;
    setPrefs(next);
    writes.current = writes.current
      .catch(() => {})
      .then(async () => {
        if (!db.current) throw new Error("更新设置尚未就绪");
        await db.current.runAsync(
          "INSERT INTO preferences(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          "appUpdates",
          JSON.stringify(next),
        );
      });
    try {
      await writes.current;
    } catch {
      setHasError(true);
      setMessage("更新设置保存失败，请重试");
    }
  }, []);
  const startDownload = useCallback(
    async (candidate: UpdatePackage, automatic = false) => {
      if (!canInstallUpdates || !native || downloading.current) return;
      if (automatic && (!prefsRef.current.wifiDownload || !native.isWifi()))
        return;
      downloading.current = true;
      setMessage("");
      setHasError(false);
      setDownload({ phase: "downloading", received: 0, total: candidate.size });
      try {
        await native.download(
          candidate.url,
          candidate.sha256,
          candidate.size,
          candidate.versionCode,
          automatic,
        );
        if (alive.current) {
          setDownload(native.downloadState());
          setMessage("安装包已校验，可以安装更新");
        }
      } catch (error) {
        if (alive.current) {
          const state = native.downloadState();
          setDownload(state);
          setHasError(state.phase !== "cancelled");
          setMessage(state.error || String(error));
        }
      } finally {
        downloading.current = false;
      }
    },
    [],
  );
  const check = useCallback(
    async (manual = true) => {
      if (
        !canInstallUpdates ||
        !loaded ||
        checkingRef.current ||
        installInProgress.current ||
        downloading.current
      )
        return;
      checkingRef.current = true;
      setChecking(true);
      setMessage("");
      setHasError(false);
      const channel = prefsRef.current.channel;
      try {
        await preferences({ checkedAt: Date.now() });
        const result = findUpdate(
          await jsonResponse(
            `https://api.github.com/repos/${updateRepository}/releases?per_page=100`,
            2000000,
          ),
          channel,
          installedApp.code,
          updateRepository,
        );
        if (!alive.current || channel !== prefsRef.current.channel) return;
        if (!result) {
          setRelease(null);
          setPackage(null);
          setDownload(emptyDownload);
          setMessage("当前没有可用的新版本");
          return;
        }
        const candidate = parseUpdatePackage(
          await jsonResponse(result.manifestUrl, 16000),
          result,
          updateRepository,
          installedApp.packageId,
        );
        if (!alive.current || channel !== prefsRef.current.channel) return;
        if (!manual && result.tag === prefsRef.current.ignoredTag) return;
        setRelease(result);
        setPackage(candidate);
        const cached = native?.downloadState();
        const alreadyDownloaded =
          cached?.phase === "ready" &&
          cached.sha256 === candidate.sha256 &&
          cached.versionCode === candidate.versionCode;
        setDownload(alreadyDownloaded ? cached : emptyDownload);
        setMessage(
          alreadyDownloaded ? "安装包已校验，可以安装更新" : "发现新版本",
        );
        if (!alreadyDownloaded && result.tag !== prefsRef.current.ignoredTag)
          void startDownload(candidate, true);
      } catch (error) {
        if (manual && alive.current) {
          setMessage(error instanceof Error ? error.message : String(error));
          setHasError(true);
        }
      } finally {
        checkingRef.current = false;
        if (alive.current) setChecking(false);
      }
    },
    [loaded, preferences, startDownload],
  );
  useEffect(() => {
    if (!loaded || !canInstallUpdates) return;
    const automatic = () => {
      const p = prefsRef.current;
      if (
        p.autoCheck &&
        Date.now() - p.checkedAt >= checkInterval &&
        AppState.currentState === "active"
      )
        void check(false);
    };
    automatic();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") automatic();
    });
    const timer = setInterval(automatic, 60000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [loaded, prefs.autoCheck, check]);
  useEffect(() => {
    if (download.phase !== "downloading" && download.phase !== "verifying")
      return;
    const timer = setInterval(() => {
      if (native) setDownload(native.downloadState());
    }, 400);
    return () => clearInterval(timer);
  }, [download.phase]);
  const install = async () => {
    if (!native || download.phase !== "ready" || installInProgress.current)
      return;
    installInProgress.current = true;
    setInstalling(true);
    setHasError(false);
    try {
      const result = await native.install();
      setMessage(
        result === "permission"
          ? "允许 Sovel 安装应用后，返回这里再次点击安装"
          : "已打开系统安装界面，安装完成后重新打开应用",
      );
    } catch (e) {
      setHasError(true);
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      installInProgress.current = false;
      setInstalling(false);
    }
  };
  return {
    prefs,
    loaded,
    release,
    packageInfo,
    checking,
    installing,
    download,
    message,
    hasError,
    preferences,
    check,
    startDownload,
    install,
    cancel: () => native?.cancelDownload(),
    openReleases: async () => {
      try {
        await Linking.openURL(
          `https://github.com/${updateRepository}/releases`,
        );
      } catch {
        setHasError(true);
        setMessage("无法打开发布页面，请检查网络或浏览器设置");
      }
    },
    changeChannel: async (channel: UpdatePreferences["channel"]) => {
      setRelease(null);
      setPackage(null);
      setDownload(emptyDownload);
      setMessage("");
      await preferences({ channel, ignoredTag: "", checkedAt: 0 });
    },
  };
}
const UpdateContext = createContext<ReturnType<typeof useUpdateStore> | null>(
  null,
);
export function UpdatesProvider({ children }: { children: React.ReactNode }) {
  return (
    <UpdateContext.Provider value={useUpdateStore()}>
      {children}
    </UpdateContext.Provider>
  );
}
export function useUpdates() {
  const value = useContext(UpdateContext);
  if (!value) throw new Error("UpdatesProvider missing");
  return value;
}
