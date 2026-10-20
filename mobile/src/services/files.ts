import { Directory, File, FileMode, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { Asset } from "expo-asset";
import {
  isAudio,
  type Entry,
  type MusicSource,
  type SourceStatus,
  type Track,
  type ScanRules,
} from "../core/types";
import { excludesPath } from "../core/scanRules";
import { readMetadata } from "../core/metadata";
import { parseLyrics } from "../core/lyrics";
import { pickInPlace, restoreAccess } from "./access";
export const music = new Directory(Paths.document, "Music");
const art = new Directory(Paths.document, "Artwork");
const roots = new Map<string, SourceStatus>();
export function prepareFiles() {
  music.create({ idempotent: true, intermediates: true });
  art.create({ idempotent: true, intermediates: true });
}
export const artUri = (path?: string) =>
  path ? new File(art, path).uri : undefined;
export function trackUri(track: Track): string {
  const source = roots.get(track.sourceId);
  if (source?.error)
    throw new Error(`${source.name} 暂时不可访问，请连接设备或重新授权`);
  if (track.sourceId === "local") return new File(music, track.path).uri;
  if (!source) throw new Error("音乐来源尚未授权");
  if (source.kind === "file") return source.uri;
  // SAF content URIs are opaque document identifiers; never concatenate paths onto them.
  return Platform.OS === "android"
    ? track.uri
    : new File(source.uri, track.path).uri;
}
export function sourceStatus(id: string) {
  return roots.get(id);
}
export function markUnavailable(id: string, error: string) {
  const source = roots.get(id);
  if (source) roots.set(id, { ...source, error });
}
export async function activate(source: MusicSource): Promise<SourceStatus> {
  let active: SourceStatus = { ...source };
  try {
    if (source.kind !== "managed") {
      const grant = await restoreAccess(source.bookmark);
      if (grant) active = { ...source, ...grant };
    }
    const item =
      source.kind === "managed"
        ? music
        : source.kind === "directory"
          ? new Directory(active.uri)
          : new File(active.uri);
    if (!item.exists)
      throw new Error("来源离线或访问权限已失效，请连接设备或重新选择来源");
  } catch (error) {
    active.error = error instanceof Error ? error.message : String(error);
  }
  roots.set(active.id, active);
  return active;
}
export async function selectSources(
  directory: boolean,
): Promise<MusicSource[]> {
  const selected = await pickInPlace(directory);
  const sources = selected.filter((item) => directory || isAudio(item.name));
  if (selected.length && !sources.length)
    throw new Error("没有选中支持的音频文件");
  return sources.map((grant) => ({
    ...grant,
    id: `source-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: directory ? "directory" : "file",
  }));
}
export async function enumerate(
  source: MusicSource,
  signal?: AbortSignal,
  rules?: ScanRules,
  onDiscover?: (count: number, path: string) => void,
): Promise<Entry[]> {
  const active = roots.get(source.id);
  if (!active || active.error) throw new Error(active?.error || "来源尚未授权");
  const entries: Entry[] = [];
  function entry(file: File, path: string, lyricUri?: string): Entry {
    if (!file.exists) throw new Error(`文件暂时不可访问：${path}`);
    return {
      path,
      uri: file.uri,
      size: file.size,
      mtime: file.info().modificationTime || 0,
      lyricUri,
    };
  }
  async function walk(dir: Directory, prefix = "") {
    if (signal?.aborted) throw new Error("扫描已取消");
    onDiscover?.(entries.length, prefix);
    const children = dir.list();
    const lyrics = new Map(
      children
        .filter((c) => c instanceof File && /\.lrc$/i.test(c.name))
        .map((c) => [c.name.toLowerCase(), c.uri]),
    );
    for (const [index, child] of children.entries()) {
      if (signal?.aborted) throw new Error("扫描已取消");
      const path = prefix + child.name;
      if (child instanceof Directory) {
        if (!rules || (rules.includeSubfolders && !excludesPath(path, rules)))
          await walk(child, `${path}/`);
      } else if (isAudio(child.name))
        entries.push(
          entry(
            child,
            path,
            lyrics.get(child.name.replace(/\.[^.]+$/, ".lrc").toLowerCase()),
          ),
        );
      if (index % 100 === 0) {
        onDiscover?.(entries.length, path);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (active.kind === "file")
    entries.push(entry(new File(active.uri), active.name));
  else {
    const dir = active.kind === "managed" ? music : new Directory(active.uri);
    if (!dir.exists) throw new Error("音乐目录不可访问，已保留原有曲库");
    await walk(dir);
  }
  onDiscover?.(entries.length, "");
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}
function artworkKey(value: string) {
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ value.charCodeAt(i);
  }
  return `${(a >>> 0).toString(36)}-${(b >>> 0).toString(36)}`;
}
export async function parseFile(entry: Entry, sourceId: string) {
  const file = new File(entry.uri!),
    handle = file.open(FileMode.ReadOnly);
  const { metadata, picture, artistPicture } = await readMetadata(
    {
      size: file.size,
      read: async (position, length) => {
        handle.offset = position;
        return handle.readBytes(length);
      },
      close: () => handle.close(),
    },
    entry.path,
  );
  if (picture && picture.data.length < 12 * 1024 * 1024) {
    const key =
      artworkKey(`${sourceId}/${entry.path}`) +
      (picture.format.includes("png") ? ".png" : ".jpg");
    const target = new File(art, key);
    await target.write(picture.data);
    metadata.artwork = key;
  }
  if (artistPicture && artistPicture.data.length < 12 * 1024 * 1024) {
    const key =
      artworkKey(`${sourceId}/${entry.path}/artist`) +
      (artistPicture.format.includes("png") ? ".png" : ".jpg");
    await new File(art, key).write(artistPicture.data);
    metadata.artistArtwork = key;
  }
  if (!metadata.lyrics.length && entry.lyricUri) {
    const sidecar = new File(entry.lyricUri);
    if (sidecar.exists && sidecar.size < 1024 * 1024)
      metadata.lyrics = parseLyrics(await sidecar.text());
  }
  return metadata;
}
async function copySafely(file: File, name: string) {
  const clean = name.replace(/[\\/\x00]/g, "_");
  let target = new File(music, clean);
  if (target.exists) {
    if (target.size === file.size && target.md5 === file.md5) return;
    const dot = clean.lastIndexOf("."),
      stem = dot < 0 ? clean : clean.slice(0, dot),
      ext = dot < 0 ? "" : clean.slice(dot);
    let n = 2;
    while (target.exists) target = new File(music, `${stem} (${n++})${ext}`);
  }
  const pending = new File(
    music,
    `${Date.now()}-${Math.random().toString(36).slice(2)}.importing`,
  );
  try {
    await file.copy(pending);
    await pending.move(target);
  } catch (error) {
    if (pending.exists) pending.delete();
    throw error;
  }
}
export async function copySelectedFiles() {
  const selected = await selectSources(false);
  for (const source of selected)
    await copySafely(new File(source.uri), source.name);
  return selected.length;
}
export async function importSamples() {
  for (const [module, name] of [
    [require("../../assets/sample.wav"), "Sovel - 初见.wav"],
    [require("../../assets/sample.flac"), "Sovel - 微光.flac"],
  ] as const) {
    const asset = await Asset.fromModule(module).downloadAsync();
    await copySafely(new File(asset.localUri!), name);
  }
}
