import type { SourceStatus, Track } from "./types";

export type DetailRow = [label: string, value: string];

export function trackDetails(
  track: Track,
  source?: SourceStatus,
  uri = track.uri,
) {
  // Only file:// exposes a filesystem path; SAF document addresses stay internal.
  let filePath = "";
  if (uri.startsWith("file://")) {
    try {
      filePath = decodeURIComponent(uri.slice(7));
    } catch {
      filePath = uri.slice(7);
    }
  }
  const displayPath =
    track.remotePath ||
    filePath ||
    (source?.kind === "directory" || source?.kind === "managed"
      ? `${track.path}（相对音乐目录）`
      : "系统未提供文件路径");
  const duration = Math.max(0, Math.floor(track.duration));
  const modified = new Date(track.mtime);
  const tags: DetailRow[] = [
    ["专辑艺术家", track.albumArtist || "未写入"],
    ["曲目 / 碟号", `${track.track || "—"} / ${track.disc || "—"}`],
    [
      "歌词",
      track.lyrics.length
        ? `${track.lyrics.length} 行 · ${track.lyrics.some((l) => l.time !== null) ? "含时间轴" : "纯文本"}`
        : "未找到歌词",
    ],
  ];
  const audio: DetailRow[] = [
    ["格式", track.format],
    [
      "时长",
      `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`,
    ],
    [
      "采样率",
      track.sampleRate ? `${track.sampleRate.toLocaleString()} Hz` : "未知",
    ],
    ["位深", track.bits ? `${track.bits} bit` : "未知"],
    ["声道", track.channels ? `${track.channels} 声道` : "未知"],
    ["文件大小", `${(track.size / 1024 / 1024).toFixed(2)} MiB`],
  ];
  const file: DetailRow[] = [
    ["文件名", (track.remotePath || track.path).split("/").pop() || track.path],
    ["文件路径", displayPath],
    [
      "修改时间",
      track.mtime > 0 && Number.isFinite(modified.getTime())
        ? modified.toLocaleString("zh-CN", { hour12: false })
        : "未知",
    ],
  ];
  return { tags, audio, file };
}
