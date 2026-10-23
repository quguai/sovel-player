import { XMLParser, XMLValidator } from "fast-xml-parser";
import { md5 } from "@noble/hashes/legacy.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  fallbackMetadata,
  isAudio,
  defaultScanRules,
  type RemoteKind,
  type RemoteSourceConfig,
  type ScanRules,
} from "./types";
import { readMetadata } from "./metadata";
import type { RemoteItem, ServerLibrary, ServerSession } from "./mediaServer";
import type { RemoteClient } from "./remoteSync";
import { excludesEntry, excludesPath } from "./scanRules";
export type ExternalKind = Exclude<RemoteKind, "jellyfin" | "emby">;
type Credentials = { username: string; password: string };
export type SmbTransport = {
  connect(
    id: string,
    host: string,
    port: number,
    username: string,
    password: string,
    share: string,
  ): Promise<string>;
  list(
    id: string,
    path: string,
  ): Promise<
    { name: string; directory: boolean; size: number; mtime: number }[]
  >;
  read(
    id: string,
    path: string,
    offset: number,
    length: number,
  ): Promise<Uint8Array>;
};
export const remoteNames: Record<RemoteKind, string> = {
  jellyfin: "Jellyfin",
  emby: "Emby",
  smb: "SMB",
  dlna: "DLNA",
  webdav: "WebDAV",
  subsonic: "OpenSubsonic",
};
function normalizeExternalUrl(value: string, kind: ExternalKind) {
  const url = new URL(value.trim());
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(kind === "smb" ? ["smb:"] : ["http:", "https:"]).includes(url.protocol)
  )
    throw new Error("地址格式不正确，请单独填写账号与密码");
  if (kind === "smb" && !url.pathname.split("/").filter(Boolean).length)
    throw new Error("请填写共享文件夹，例如 smb://192.168.1.10/Music");
  return url.toString().replace(/\/+$/, "");
}
const list = <T>(value: T | T[] | undefined | null): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];
export function xml(text: string): any {
  if (
    text.length > 4 * 1024 * 1024 ||
    /<!DOCTYPE|<!ENTITY/i.test(text) ||
    XMLValidator.validate(text) !== true
  )
    throw new Error("服务器返回的 XML 无效或过大");
  return new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: true,
  }).parse(text);
}
const text = (value: any): string =>
  typeof value === "object"
    ? String(value?.["#text"] ?? "")
    : String(value ?? "");
const escape = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const b64 = (value: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(value)));
const pathname = (value: string) => decodeURIComponent(new URL(value).pathname);
function check(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("同步已取消，原有曲库已保留");
}
type ExternalOptions = {
  smb?: SmbTransport;
  rules?: ScanRules;
  nonce?: string;
  httpRead?: (
    url: string,
    headers: Record<string, string>,
    offset: number,
    length: number,
  ) => Promise<Uint8Array>;
};
export class ExternalSource implements RemoteClient {
  readonly baseUrl: string;
  private inventory: RemoteItem[] | null = null;
  private credentials: Credentials = { username: "", password: "" };
  private controlUrl = "";
  private serviceType = "urn:schemas-upnp-org:service:ContentDirectory:1";
  private smbId = "";
  private rules: ScanRules;
  private onFound: (n: number) => void = () => {};
  proxy = "";
  constructor(
    url: string,
    readonly kind: ExternalKind,
    private request: typeof fetch = fetch,
    private options: ExternalOptions = {},
  ) {
    this.baseUrl = normalizeExternalUrl(url, kind);
    this.rules = options.rules ?? defaultScanRules;
  }
  setCredentials(token: string) {
    if (this.kind === "dlna") return;
    const value = JSON.parse(token);
    if (
      typeof value.username !== "string" ||
      typeof value.password !== "string"
    )
      throw new Error("请重新登录音乐来源");
    this.credentials = value;
  }
  private auth(): Record<string, string> {
    return this.kind === "webdav" &&
      (this.credentials.username || this.credentials.password)
      ? {
          Authorization: `Basic ${b64(`${this.credentials.username}:${this.credentials.password}`)}`,
        }
      : {};
  }
  private async requestText(
    url: string,
    options: RequestInit = {},
    signal?: AbortSignal,
  ) {
    check(signal);
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 20000);
    try {
      const response = await this.request(url, {
        ...options,
        signal: controller.signal,
        redirect: "error",
      });
      if (!response.ok)
        throw new Error(
          response.status === 401 || response.status === 403
            ? "账号或访问权限不正确"
            : `服务器请求失败（${response.status}）`,
        );
      const result = await response.text();
      check(signal);
      return result;
    } catch (e) {
      check(signal);
      if (e instanceof Error && /^(账号|服务器请求)/.test(e.message)) throw e;
      throw new Error("无法读取远程来源，请检查连接后重试");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
  async login(username: string, password: string): Promise<ServerSession> {
    this.credentials = { username, password };
    if (this.kind === "smb") {
      await this.openSmb("probe:" + this.baseUrl);
      await this.options.smb!.list(this.smbId, this.smbRoot());
    } else if (this.kind === "webdav") await this.dav(this.baseUrl);
    else if (this.kind === "dlna") await this.describe();
    else await this.subsonic("ping");
    return {
      token: JSON.stringify(this.credentials),
      userId: username,
      serverId: this.baseUrl,
    };
  }
  async libraries(): Promise<ServerLibrary[]> {
    if (this.kind === "subsonic") {
      const data = await this.subsonic("getMusicFolders");
      return list<any>(data.musicFolders?.musicFolder).map((f) => ({
        id: String(f.id),
        name: f.name || "音乐库",
      }));
    }
    if (this.kind === "dlna") {
      const page = await this.browse("0", 0);
      return [
        { id: "0", name: this.serverName || "DLNA 音乐库" },
        ...page.folders,
      ];
    }
    if (this.kind === "webdav") {
      const entries = await this.dav(this.baseUrl);
      return [
        {
          id: this.baseUrl,
          name: decodeURIComponent(
            new URL(this.baseUrl).pathname.split("/").filter(Boolean).pop() ||
              new URL(this.baseUrl).hostname,
          ),
        },
        ...entries
          .filter((e) => e.directory)
          .map((e) => ({ id: e.url, name: e.name })),
      ];
    }
    const root = this.smbRoot();
    const entries = await this.options.smb!.list(this.smbId, root);
    return [
      {
        id: root,
        name: decodeURIComponent(
          new URL(this.baseUrl).pathname.split("/").filter(Boolean).pop() ||
            "共享文件夹",
        ),
      },
      ...entries
        .filter((e) => e.directory && !e.name.startsWith("."))
        .map((e) => ({
          id: [root, e.name].filter(Boolean).join("/"),
          name: e.name,
        })),
    ];
  }
  private smbRoot() {
    return decodeURIComponent(new URL(this.baseUrl).pathname)
      .split("/")
      .filter(Boolean)
      .slice(1)
      .join("/");
  }
  async openSmb(id: string) {
    if (!this.options.smb) throw new Error("请更新安装包以启用 SMB");
    const url = new URL(this.baseUrl);
    const share = decodeURIComponent(
      url.pathname.split("/").filter(Boolean)[0],
    );
    this.smbId = id;
    this.proxy = await this.options.smb!.connect(
      id,
      url.hostname,
      Number(url.port || 445),
      this.credentials.username,
      this.credentials.password,
      share,
    );
  }
  private async dav(url: string, signal?: AbortSignal) {
    const response = await this.requestText(
      url.endsWith("/") ? url : url + "/",
      {
        method: "PROPFIND",
        headers: {
          ...this.auth(),
          Depth: "1",
          "Content-Type": "application/xml",
        },
        body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/><d:getlastmodified/><d:displayname/></d:prop></d:propfind>',
      },
      signal,
    );
    const root = new URL(url.endsWith("/") ? url : url + "/");
    const data = xml(response);
    if (!data.multistatus) throw new Error("服务器未返回 WebDAV 目录");
    const result = [];
    for (const row of list<any>(data.multistatus.response)) {
      const target = new URL(text(row.href), root);
      if (
        target.origin !== root.origin ||
        !target.pathname.startsWith(root.pathname) ||
        target.pathname.replace(/\/$/, "") === root.pathname.replace(/\/$/, "")
      )
        continue;
      const propstat = list<any>(row.propstat);
      const ok = propstat.find((p) => / 200 /.test(text(p.status)));
      if (!ok) throw new Error("部分 WebDAV 文件无法读取，原有曲库已保留");
      const props = ok.prop || {};
      const directory =
        props.resourcetype && Object.hasOwn(props.resourcetype, "collection");
      result.push({
        url: target.toString().replace(/\/$/, ""),
        name:
          text(props.displayname) ||
          decodeURIComponent(
            target.pathname.split("/").filter(Boolean).pop() || "",
          ),
        directory: !!directory,
        size: Number(props.getcontentlength || 0),
        mtime: Date.parse(text(props.getlastmodified)) || 0,
      });
    }
    return result;
  }
  private serverName = "";
  private async describe(signal?: AbortSignal) {
    const data = xml(await this.requestText(this.baseUrl, {}, signal));
    const root = data.root;
    const devices: any[] = [root?.device];
    let service: any;
    while (devices.length) {
      const device = devices.shift();
      if (!device) continue;
      service = list<any>(device.serviceList?.service).find((s) =>
        text(s.serviceType).includes(":ContentDirectory:"),
      );
      if (service) {
        this.serverName = text(device.friendlyName);
        break;
      }
      devices.push(...list<any>(device.deviceList?.device));
    }
    if (!service) throw new Error("此设备没有提供 DLNA 音乐目录");
    this.serviceType = text(service.serviceType);
    this.controlUrl = new URL(
      text(service.controlURL),
      text(root.URLBase) || this.baseUrl,
    ).toString();
  }
  private async browse(id: string, start: number, signal?: AbortSignal) {
    if (!this.controlUrl) await this.describe(signal);
    const body = `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:Browse xmlns:u="${escape(this.serviceType)}"><ObjectID>${escape(id)}</ObjectID><BrowseFlag>BrowseDirectChildren</BrowseFlag><Filter>*</Filter><StartingIndex>${start}</StartingIndex><RequestedCount>100</RequestedCount><SortCriteria></SortCriteria></u:Browse></s:Body></s:Envelope>`;
    const data = xml(
      await this.requestText(
        this.controlUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": 'text/xml; charset="utf-8"',
            SOAPAction: `"${this.serviceType}#Browse"`,
          },
          body,
        },
        signal,
      ),
    );
    const page = data.Envelope?.Body?.BrowseResponse;
    if (!page) throw new Error("DLNA 返回的目录不完整");
    const count = Number(page.NumberReturned),
      total = Number(page.TotalMatches);
    if (
      !Number.isSafeInteger(count) ||
      !Number.isSafeInteger(total) ||
      count < 0 ||
      total < 0 ||
      start + count > total ||
      (count === 0 && start < total)
    )
      throw new Error("DLNA 分页不完整，原有曲库已保留");
    const didl = text(page.Result)
      ? xml(text(page.Result))["DIDL-Lite"] || {}
      : {};
    const folders = list<any>(didl.container).map((c) => ({
      id: text(c["@_id"]),
      name: text(c.title),
    }));
    const items = list<any>(didl.item)
      .filter((i) => text(i.class).includes("audioItem"))
      .flatMap((i) => {
        const resource = list<any>(i.res).find(
          (r) =>
            /^https?:\/\//i.test(text(r)) &&
            /^http-get:/i.test(text(r["@_protocolInfo"])),
        );
        if (!resource) return [];
        const uri = new URL(text(resource), this.controlUrl).toString();
        const duration =
          text(resource["@_duration"])
            .split(":")
            .reduce((sum, v) => sum * 60 + Number(v), 0) || 0;
        const filename = decodeURIComponent(
          new URL(uri).pathname.split("/").pop() || text(i.title),
        );
        const mime = text(resource["@_protocolInfo"])
          .split(":")[2]
          ?.split(";")[0]
          .toLowerCase();
        const formats: Record<string, string> = {
          "audio/flac": "FLAC",
          "audio/x-flac": "FLAC",
          "audio/wav": "WAV",
          "audio/x-wav": "WAV",
          "audio/wave": "WAV",
          "audio/mpeg": "MP3",
          "audio/mp4": "M4A",
          "audio/aac": "AAC",
          "audio/aiff": "AIFF",
          "audio/x-aiff": "AIFF",
          "audio/ogg": "OGG",
          "audio/l16": "PCM",
          "audio/l24": "PCM",
        };
        return [
          {
            id: text(i["@_id"]),
            path: uri,
            size: Number(resource["@_size"] || 0),
            mtime: 0,
            metadata: {
              ...fallbackMetadata(filename),
              format: isAudio(filename)
                ? fallbackMetadata(filename).format
                : formats[mime] || "UNKNOWN",
              title: text(i.title) || filename,
              artist: text(i.artist) || text(i.creator) || "未知艺术家",
              album: text(i.album) || "未命名专辑",
              duration,
              sampleRate: Number(resource["@_sampleFrequency"]) || undefined,
              bits: Number(resource["@_bitsPerSample"]) || undefined,
              channels: Number(resource["@_nrAudioChannels"]) || undefined,
              track: Number(i.originalTrackNumber) || undefined,
              artwork: i.albumArtURI
                ? new URL(text(i.albumArtURI), this.controlUrl).toString()
                : undefined,
              remoteId: text(i["@_id"]),
              mediaSourceId: uri,
            },
          },
        ];
      });
    return { folders, items, count, total };
  }
  private subsonicUrl(
    method: string,
    params: Record<string, string | number> = {},
  ) {
    const nonce = this.options.nonce;
    if (!nonce) throw new Error("OpenSubsonic 需要会话认证参数");
    const query = new URLSearchParams({
      u: this.credentials.username,
      t: bytesToHex(
        md5(new TextEncoder().encode(this.credentials.password + nonce)),
      ),
      s: nonce,
      v: "1.16.1",
      c: "Sovel",
      ...Object.fromEntries(
        Object.entries(params).map(([key, value]) => [key, String(value)]),
      ),
    });
    return `${this.baseUrl}/rest/${method}.view?${query}`;
  }
  private async subsonic(
    method: string,
    params: Record<string, string | number> = {},
    signal?: AbortSignal,
  ) {
    const data = JSON.parse(
      await this.requestText(
        this.subsonicUrl(method, { f: "json", ...params }),
        {},
        signal,
      ),
    );
    const result = data["subsonic-response"];
    if (result?.status !== "ok")
      throw new Error("OpenSubsonic 登录失败或服务器不兼容");
    return result;
  }
  private async inventoryFor(config: RemoteSourceConfig, signal: AbortSignal) {
    const items = new Map<string, RemoteItem>();
    const queue = [config.libraryId];
    const seen = new Set<string>();
    while (queue.length) {
      check(signal);
      const root = queue.shift()!;
      if (seen.has(root)) continue;
      seen.add(root);
      if (seen.size > 20000 || items.size > 100000)
        throw new Error("目录规模过大，请选择较小的音乐目录");
      if (this.kind === "dlna") {
        let start = 0,
          total = 0;
        do {
          const page = await this.browse(root, start, signal);
          if (start && total !== page.total)
            throw new Error("服务器目录正在变化，请重新同步");
          total = page.total;
          page.folders.forEach((f) => queue.push(f.id));
          page.items.forEach((i) => items.set(i.id, i));
          start += page.count;
          this.onFound(items.size);
        } while (start < total);
      } else if (this.kind === "subsonic") {
        let offset = 0;
        const albums = new Set<string>();
        for (;;) {
          const data = await this.subsonic(
            "getAlbumList2",
            {
              type: "alphabeticalByName",
              size: 100,
              offset,
              musicFolderId: root,
            },
            signal,
          );
          const page = list<any>(data.albumList2?.album);
          if (!page.length) break;
          for (const album of page) {
            if (albums.has(album.id))
              throw new Error("服务器专辑分页重复，请重新同步");
            albums.add(album.id);
            const detail = await this.subsonic(
              "getAlbum",
              { id: album.id },
              signal,
            );
            for (const song of list<any>(detail.album?.song)) {
              const format = String(song.suffix || "").toUpperCase();
              items.set(String(song.id), {
                id: String(song.id),
                path: song.path || song.title,
                size: Number(song.size || 0),
                mtime: Date.parse(song.created || "") || 0,
                metadata: {
                  ...fallbackMetadata(song.title),
                  title: song.title,
                  artist: song.artist || "未知艺术家",
                  album: song.album || detail.album.name || "未命名专辑",
                  duration: Number(song.duration || 0),
                  format,
                  year: song.year,
                  track: song.track,
                  disc: song.discNumber,
                  sampleRate: song.samplingRate,
                  bits: song.bitDepth,
                  genres: song.genre ? [song.genre] : [],
                  remoteId: String(song.id),
                  artwork: song.coverArt
                    ? `subsonic-art:${song.coverArt}`
                    : undefined,
                },
              });
            }
            this.onFound(items.size);
          }
          offset += page.length;
          if (offset > 100000)
            throw new Error("服务器专辑过多，请分音乐库导入");
        }
      } else {
        const rows =
          this.kind === "webdav"
            ? await this.dav(root, signal)
            : await this.options.smb!.list(this.smbId, root).then((rows) =>
                rows.map((row) => ({
                  ...row,
                  url: [root, row.name].filter(Boolean).join("/"),
                })),
              );
        for (const row of rows) {
          const relative =
            this.kind === "webdav"
              ? pathname(row.url)
                  .slice(pathname(config.libraryId).length)
                  .replace(/^\//, "")
              : row.url.slice(config.libraryId.length).replace(/^\//, "");
          if (excludesPath(relative, this.rules)) continue;
          if (row.directory) {
            if (this.rules.includeSubfolders) queue.push(row.url);
          } else if (
            isAudio(row.name) &&
            !excludesEntry({ path: relative, size: row.size }, this.rules)
          ) {
            items.set(row.url, {
              id: row.url,
              path: relative,
              size: row.size,
              mtime: row.mtime,
              metadata: { ...fallbackMetadata(row.name), remoteId: row.url },
            });
          }
        }
        this.onFound(items.size);
      }
    }
    return [...items.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
  resetInventory(onFound: (n: number) => void, rules: ScanRules) {
    this.inventory = null;
    this.onFound = onFound;
    this.rules = rules;
  }
  async items(
    config: RemoteSourceConfig,
    _token: string,
    offset: number,
    signal: AbortSignal,
  ) {
    this.inventory ??= await this.inventoryFor(config, signal);
    return {
      total: this.inventory.length,
      items: this.inventory.slice(offset, offset + 100),
    };
  }
  stream(_config: RemoteSourceConfig, id: string, mediaId?: string) {
    if (this.kind === "dlna") return mediaId || id;
    return this.kind === "smb"
      ? `smb://${new URL(this.baseUrl).host}/${new URL(this.baseUrl).pathname.split("/").filter(Boolean)[0]}/${id.split("/").map(encodeURIComponent).join("/")}`
      : this.kind === "subsonic"
        ? `${this.baseUrl}/rest/stream.view?id=${encodeURIComponent(id)}`
        : id;
  }
  playback(id: string) {
    if (this.kind === "smb") {
      if (!this.proxy) throw new Error("SMB 尚未连接");
      return {
        uri: this.proxy + id.split("/").map(encodeURIComponent).join("/"),
      };
    }
    if (this.kind === "subsonic")
      return { uri: this.subsonicUrl("stream", { id, format: "raw" }) };
    return {
      uri: id,
      headers: this.kind === "webdav" ? this.auth() : undefined,
    };
  }
  artwork(id: string) {
    if (this.kind !== "subsonic") return id;
    return this.subsonicUrl("getCoverArt", {
      id: id.replace(/^subsonic-art:/, ""),
      size: 600,
    });
  }

  async hydrate(item: RemoteItem, signal: AbortSignal): Promise<RemoteItem> {
    if (this.kind !== "webdav" && this.kind !== "smb") return item;
    if (item.size <= 0) throw new Error("服务器未提供文件大小，请检查共享目录");
    let failure: unknown;
    const parsed = await readMetadata(
      {
        size: item.size,
        close: () => {},
        read: async (offset, length) => {
          try {
            check(signal);
            if (this.kind === "smb")
              return await this.options.smb!.read(
                this.smbId,
                item.id,
                offset,
                length,
              );
            if (!this.options.httpRead)
              throw new Error("请更新原生安装包以读取 WebDAV 文件");
            const data = await this.options.httpRead(
              item.id,
              this.auth(),
              offset,
              length,
            );
            check(signal);
            return data;
          } catch (e) {
            failure = e;
            throw e;
          }
        },
      },
      item.path,
    );
    if (failure) throw failure;
    return {
      ...item,
      metadata: { ...parsed.metadata, remoteId: item.id },
      picture: parsed.picture,
      artistPicture: parsed.artistPicture,
    };
  }
}
