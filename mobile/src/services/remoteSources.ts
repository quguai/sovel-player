import { requireOptionalNativeModule } from "expo";
import type { MusicSource, Track } from "../core/types";
import { isRemoteSource } from "../core/types";
import { MediaServer } from "../core/mediaServer";
const sessions = new Map<string, { source: MusicSource; token: string }>();
async function secureStore() {
  if (!requireOptionalNativeModule("ExpoSecureStore"))
    throw new Error("请安装新版原生应用以安全保存服务器登录信息");
  return import("expo-secure-store");
}
const key = (id: string) => `sovel.source.${id}`;
export async function saveSourceToken(id: string, token: string) {
  const store = await secureStore();
  try {
    await store.setItemAsync(key(id), token, {
      keychainAccessible: store.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  } catch {
    throw new Error("无法保存安全登录信息，请使用正确签名的原生应用");
  }
}
export async function activateRemote(source: MusicSource) {
  try {
    const store = await secureStore();
    const token = await store.getItemAsync(key(source.id));
    if (!token) throw new Error("请重新登录此音乐来源");
    sessions.set(source.id, { source, token });
    return { ...source };
  } catch (error) {
    sessions.delete(source.id);
    return {
      ...source,
      error:
        error instanceof Error && /^(请安装|请重新)/.test(error.message)
          ? error.message
          : "无法读取安全登录信息，请使用正确签名的应用重新连接",
    };
  }
}
export function sourceToken(sourceId: string) {
  const entry = sessions.get(sourceId);
  if (!entry) throw new Error("来源尚未登录，请在音乐来源中重新连接");
  return entry.token;
}
export function remotePlaybackSource(track: {
  sourceId: string;
  remoteId?: string;
  mediaSourceId?: string;
}) {
  const entry = sessions.get(track.sourceId);
  if (!entry?.source.config || !isRemoteSource(entry.source))
    throw new Error("远程音乐来源尚未登录");
  return {
    uri: new MediaServer(
      entry.source.config.baseUrl,
      entry.source.kind as "jellyfin" | "emby",
    ).stream(entry.source.config, track.remoteId!, track.mediaSourceId),
    headers: { "X-Emby-Token": entry.token },
  };
}
export function remoteArtworkUri(value: string) {
  if (!value.startsWith("sovel-art:")) return value;
  try {
    const data = JSON.parse(value.slice("sovel-art:".length)) as [
      string,
      string,
    ];
    const entry = sessions.get(data[0]);
    if (!entry?.source.config) return undefined;
    const url = new URL(data[1]);
    if (url.origin !== new URL(entry.source.config.baseUrl).origin)
      return undefined;
    // Image/lock-screen artwork APIs do not all support headers. Only the transient
    // in-memory URL gets a token; SQLite and backups never store authenticated URLs.
    url.searchParams.set("api_key", entry.token);
    return url.toString();
  } catch {
    return undefined;
  }
}

export async function serverDeviceId() {
  const store = await secureStore();
  try {
    const existing = await store.getItemAsync("sovel.device");
    if (existing) return existing;
    const id = `sovel-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await store.setItemAsync("sovel.device", id);
    return id;
  } catch {
    throw new Error("无法访问安全登录信息，请使用正确签名的原生应用");
  }
}
export async function remoteLyrics(track: Track): Promise<Track> {
  const entry = sessions.get(track.sourceId);
  if (
    !entry?.source.config ||
    entry.source.kind !== "jellyfin" ||
    !track.remoteId
  )
    return { ...track, remoteLyricsLoaded: true };
  try {
    const lyrics = await new MediaServer(
      entry.source.config.baseUrl,
      "jellyfin",
    ).lyrics(entry.token, track.remoteId);
    return { ...track, lyrics, remoteLyricsLoaded: true };
  } catch {
    return { ...track, remoteLyricsLoaded: true };
  }
}
