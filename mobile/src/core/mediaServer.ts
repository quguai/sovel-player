import {
  fallbackMetadata,
  type Metadata,
  type RemoteSourceConfig,
} from "./types";
export type ServerKind = "jellyfin" | "emby";
export type ServerSession = {
  token: string;
  userId: string;
  serverId: string;
  deviceId?: string;
};
export type ServerLibrary = { id: string; name: string };
export type RemoteItem = {
  id: string;
  path: string;
  size: number;
  mtime: number;
  metadata: Metadata;
};
export const normalizeServerUrl = (value: string) => {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("请输入完整的服务器地址，例如 https://music.example.com");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("地址仅支持 HTTP / HTTPS，不要在地址中填写账号或令牌");
  return url.toString().replace(/\/+$/, "");
};
export class MediaServer {
  readonly baseUrl: string;
  private albumTags = new Map<
    string,
    { ProviderIds?: Record<string, string> }
  >();
  constructor(
    baseUrl: string,
    readonly kind: ServerKind,
    private request: typeof fetch = fetch,
    private deviceId = "sovel-player",
  ) {
    this.baseUrl = normalizeServerUrl(baseUrl);
  }
  url(path: string, query: Record<string, string | number | undefined> = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) params.set(key, String(value));
    return `${this.baseUrl}${path}${params.size ? `?${params}` : ""}`;
  }
  async json(
    path: string,
    token?: string,
    query: Record<string, string | number | undefined> = {},
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<any> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const timeout = setTimeout(abort, 20000);
    try {
      const response = await this.request(this.url(path, query), {
        method: body === undefined ? "GET" : "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Emby-Authorization": `MediaBrowser Client="Sovel", Device="Sovel HiFi", DeviceId="${this.deviceId}", Version="0.1.0"`,
          ...(token ? { "X-Emby-Token": token } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "登录已失效或账号密码不正确，请重新登录"
            : response.status === 403
              ? "当前账号没有访问音乐库的权限"
              : `服务器请求失败（${response.status}）`,
        );
      return await response.json();
    } catch (error) {
      if (signal?.aborted) throw new Error("同步已取消，原有曲库已保留");
      if (controller.signal.aborted)
        throw new Error("服务器响应超时，请检查连接后重试");
      // Never surface response bodies or URLs containing credentials.
      if (
        error instanceof Error &&
        /^(登录|当前账号|服务器请求)/.test(error.message)
      )
        throw error;
      throw new Error("无法连接服务器，请检查地址和网络");
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
  async login(username: string, password: string): Promise<ServerSession> {
    const result = await this.json(
      "/Users/AuthenticateByName",
      undefined,
      {},
      { Username: username.trim(), Pw: password },
    );
    if (!result.AccessToken || !result.User?.Id || !result.ServerId)
      throw new Error("服务器返回的登录信息不完整");
    return {
      token: result.AccessToken,
      userId: result.User.Id,
      serverId: result.ServerId,
      deviceId: this.deviceId,
    };
  }
  async libraries(session: ServerSession): Promise<ServerLibrary[]> {
    const result = await this.json(
      `/Users/${encodeURIComponent(session.userId)}/Views`,
      session.token,
    );
    if (!Array.isArray(result.Items))
      throw new Error("服务器未返回有效的音乐库列表");
    return result.Items.filter((i: any) => i.CollectionType === "music").map(
      (i: any) => ({ id: i.Id, name: i.Name }),
    );
  }
  async items(
    config: RemoteSourceConfig,
    token: string,
    offset: number,
    signal: AbortSignal,
  ) {
    const result = await this.json(
      `/Users/${encodeURIComponent(config.userId)}/Items`,
      token,
      {
        ParentId: config.libraryId,
        Recursive: "true",
        IncludeItemTypes: "Audio",
        StartIndex: offset,
        Limit: 100,
        SortBy: "SortName",
        SortOrder: "Ascending",
        Fields:
          "MediaSources,MediaStreams,ProviderIds,DateCreated,DateLastMediaAdded,Path,Genres,DateLastSaved",
        EnableTotalRecordCount: "true",
      },
      undefined,
      signal,
    );
    if (
      !Array.isArray(result.Items) ||
      !Number.isSafeInteger(result.TotalRecordCount) ||
      result.TotalRecordCount < 0
    )
      throw new Error("服务器返回的歌曲分页数据不完整");
    const albumIds = [
      ...new Set<string>(
        result.Items.map((item: any) => item.AlbumId).filter(
          (id: unknown) => typeof id === "string" && id.length > 0,
        ),
      ),
    ].filter((id) => !this.albumTags.has(id));
    if (albumIds.length) {
      // Release IDs often belong to MusicAlbum, not Audio. Batch lookups and
      // retain a bounded cache, rather than fetching one album for every song.
      const albums = await this.json(
        `/Users/${encodeURIComponent(config.userId)}/Items`,
        token,
        {
          Ids: albumIds.join(","),
          IncludeItemTypes: "MusicAlbum",
          Fields: "ProviderIds",
          Limit: albumIds.length,
        },
        undefined,
        signal,
      );
      for (const id of albumIds) this.albumTags.set(id, {});
      for (const album of albums.Items || [])
        if (albumIds.includes(album.Id))
          this.albumTags.set(album.Id, { ProviderIds: album.ProviderIds });
      while (this.albumTags.size > 512)
        this.albumTags.delete(this.albumTags.keys().next().value!);
    }
    return {
      total: result.TotalRecordCount as number,
      items: result.Items.map((item: any) =>
        this.mapItem(item),
      ) as RemoteItem[],
    };
  }
  private mapItem(item: any): RemoteItem {
    if (!item?.Id || !item.Name)
      throw new Error("服务器返回的歌曲缺少标识，已停止同步");
    const media = item.MediaSources?.[0] || {};
    const audio =
      (media.MediaStreams || item.MediaStreams || []).find(
        (s: any) => s.Type === "Audio",
      ) || {};
    const codec = String(
      audio.Codec || media.Container || item.Container || "",
    ).toUpperCase();
    const format =
      codec === "PCM_S16LE" || codec.startsWith("PCM_") ? "WAV" : codec;
    const artist =
      item.Artists?.join(" / ") ||
      item.ArtistItems?.map((a: any) => a.Name).join(" / ") ||
      "未知艺术家";
    const artworkId = item.ImageTags?.Primary ? item.Id : item.AlbumId;
    const artworkTag = item.ImageTags?.Primary || item.AlbumPrimaryImageTag;
    return {
      id: item.Id,
      path: item.Path || item.Name,
      size: Number(media.Size || item.Size || 0),
      mtime: Date.parse(item.DateLastSaved || item.DateCreated || "") || 0,
      metadata: {
        ...fallbackMetadata(item.Name),
        title: item.Name,
        artist,
        album: item.Album || "未命名专辑",
        albumArtist: item.AlbumArtist || item.AlbumArtists?.[0],
        genres: item.Genres || [],
        format,
        duration: (item.RunTimeTicks || 0) / 10000000,
        sampleRate: audio.SampleRate,
        bits: audio.BitDepth,
        channels: audio.Channels,
        disc: item.ParentIndexNumber,
        track: item.IndexNumber,
        recordingId: item.ProviderIds?.MusicBrainzTrack,
        releaseId:
          item.ProviderIds?.MusicBrainzAlbum ||
          this.albumTags.get(item.AlbumId)?.ProviderIds?.MusicBrainzAlbum,
        year: item.ProductionYear,
        edition: item.ExtraType,
        remoteId: item.Id,
        mediaSourceId: media.Id,
        artistArtwork: item.ArtistItems?.[0]?.Id
          ? this.url(
              `/Items/${encodeURIComponent(item.ArtistItems[0].Id)}/Images/Primary`,
              { maxWidth: 320, quality: 85 },
            )
          : undefined,
        artwork: artworkId
          ? this.url(`/Items/${encodeURIComponent(artworkId)}/Images/Primary`, {
              maxWidth: 640,
              quality: 85,
              tag: artworkTag,
            })
          : undefined,
      },
    };
  }
  async lyrics(token: string, id: string) {
    if (this.kind !== "jellyfin") return [];
    const result = await this.json(
      `/Audio/${encodeURIComponent(id)}/Lyrics`,
      token,
    );
    if (!Array.isArray(result.Lyrics)) return [];
    return result.Lyrics.filter(
      (line: any) => typeof line.Text === "string",
    ).map((line: any) => ({
      text: line.Text,
      time: typeof line.Start === "number" ? line.Start / 10000000 : null,
    }));
  }
  stream(config: RemoteSourceConfig, remoteId: string, mediaSourceId?: string) {
    return this.url(`/Audio/${encodeURIComponent(remoteId)}/stream`, {
      Static: "true",
      UserId: config.userId,
      MediaSourceId: mediaSourceId,
      DeviceId: config.deviceId,
    });
  }
}
