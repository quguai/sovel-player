import { requireOptionalNativeModule } from "expo";
import type { MusicSource, Track, ScanRules } from "../core/types";
import { isRemoteSource } from "../core/types";
import { MediaServer } from "../core/mediaServer";
import { ExternalSource, type ExternalKind } from "../core/externalSources";
import { networkModule } from "./network";
import { Directory, File, Paths } from "expo-file-system";
import { md5 } from "@noble/hashes/legacy.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { RemoteItem } from "../core/mediaServer";
import type { RemoteClient } from "../core/remoteSync";
const sessions = new Map<
  string,
  {
    source: MusicSource;
    token: string;
    client?: ExternalSource;
    connecting?: Promise<void>;
  }
>();

function externalClient(url: string, kind: ExternalKind) {
  const native = networkModule();
  return new ExternalSource(url, kind, fetch, {
    smb: {
      connect: (...args) => native.smbConnect(...args),
      list: (...args) => native.smbList(...args),
      read: async (...args) =>
        Uint8Array.from(atob(await native.smbRead(...args)), (c) =>
          c.charCodeAt(0),
        ),
    },
    nonce: native.nonce(),
    httpRead: async (...args) =>
      Uint8Array.from(atob(await native.httpRead(...args)), (c) =>
        c.charCodeAt(0),
      ),
  });
}
export async function externalLogin(
  url: string,
  kind: ExternalKind,
  username: string,
  password: string,
) {
  const client = externalClient(url, kind);
  try {
    const session = await client.login(username, password);
    return {
      session,
      libraries: await client.libraries(),
      url: client.baseUrl,
    };
  } finally {
    if (kind === "smb")
      await networkModule().smbClose("probe:" + client.baseUrl);
  }
}
export async function syncClient(
  source: MusicSource,
  rules: ScanRules,
  onFound: (n: number) => void,
): Promise<RemoteClient> {
  await prepareRemoteSources([{ sourceId: source.id }]);
  const entry = sessions.get(source.id);
  if (!entry) throw new Error("请重新登录音乐来源");
  if (!entry.client)
    return new MediaServer(
      source.config!.baseUrl,
      source.kind as "jellyfin" | "emby",
    );
  entry.client.resetInventory(onFound, rules);
  const client = entry.client;
  return {
    items: (...args) => client.items(...args),
    stream: (...args) => client.stream(...args),
    hydrate:
      source.kind === "smb" || source.kind === "webdav"
        ? async (item, signal) =>
            cacheArtwork(await client.hydrate(item, signal))
        : undefined,
  };
}
async function cacheArtwork(item: RemoteItem): Promise<RemoteItem> {
  const { picture, artistPicture, ...result } = item;
  for (const [image, field] of [
    [picture, "artwork"],
    [artistPicture, "artistArtwork"],
  ] as const) {
    if (!image || image.data.length > 12 * 1024 * 1024) continue;
    const name =
      bytesToHex(md5(image.data)) +
      (image.format.includes("png") ? ".png" : ".jpg");
    await new File(new Directory(Paths.document, "Artwork"), name).write(
      image.data,
    );
    result.metadata[field] = name;
  }
  return result;
}
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
    const previous = sessions.get(source.id);
    if (
      previous?.token === token &&
      previous.source.config?.baseUrl === source.config?.baseUrl &&
      previous.client
    ) {
      previous.source = source;
      return { ...source };
    }
    let client: ExternalSource | undefined;
    if (source.kind !== "jellyfin" && source.kind !== "emby") {
      client = externalClient(
        source.config!.baseUrl,
        source.kind as ExternalKind,
      );
      client.setCredentials(token);
    }
    sessions.set(source.id, { source, token, client });
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
/** Connections are lazy so an offline NAS never delays opening the local library. */
export async function prepareRemoteSources(tracks: { sourceId: string }[]) {
  for (const id of new Set(tracks.map((t) => t.sourceId))) {
    const entry = sessions.get(id);
    if (entry?.source.kind !== "smb" || !entry.client || entry.client.proxy)
      continue;
    entry.connecting ??= entry.client.openSmb(id).finally(() => {
      entry.connecting = undefined;
    });
    try {
      await entry.connecting;
    } catch {
      throw new Error(
        `${entry.source.name} 连接失败，请检查 SMB 地址、网络或账号后重试`,
      );
    }
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
  if (entry.client)
    return entry.client.playback(
      entry.source.kind === "dlna"
        ? track.mediaSourceId || track.remoteId!
        : track.remoteId!,
    );
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
    if (entry.source.kind === "subsonic") return entry.client?.artwork(data[1]);
    if (entry.source.kind === "dlna") return data[1];
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
