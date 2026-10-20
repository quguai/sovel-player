import { defaultEqualizer, type EqualizerSettings } from "./equalizer";
export type HomeStyle = "gallery" | "library" | "quiet";
export type PlayerStyle = "cover" | "vinyl" | "immersive";
export type RecordStyle =
  | "black"
  | "clear"
  | "matte"
  | "pearl"
  | "dusk"
  | "aurora"
  | "amber"
  | "rose"
  | "jade";
export const recordSpeeds = {
  slow: { name: "慢速", duration: 32000 },
  standard: { name: "标准", duration: 22000 },
  fast: { name: "快速", duration: 12000 },
} as const;
export type RecordSpeed = keyof typeof recordSpeeds;
export type TonearmStyle = "simple" | "classic";
export const cartridgeColors = {
  original: {
    name: "原色",
    color: "#303235",
    highlight: "#505358",
    shadow: "#1c1e21",
  },
  silver: {
    name: "银白",
    color: "#c9cfce",
    highlight: "#f3f4ec",
    shadow: "#737e81",
  },
  gold: {
    name: "香槟金",
    color: "#bca078",
    highlight: "#ead7ae",
    shadow: "#725b40",
  },
  wine: {
    name: "酒红",
    color: "#914c58",
    highlight: "#be7d86",
    shadow: "#512c38",
  },
  ice: {
    name: "冰蓝",
    color: "#7da6c6",
    highlight: "#bad9e9",
    shadow: "#3d5e79",
  },
  jade: {
    name: "墨绿",
    color: "#527d70",
    highlight: "#8db4a0",
    shadow: "#2b493f",
  },
} as const;
export type CartridgeColor = keyof typeof cartridgeColors;
export const stylusLights = {
  ruby: { name: "暖红", color: "#ed593e" },
  amber: { name: "琥珀", color: "#e9b35d" },
  ice: { name: "冰蓝", color: "#70bfff" },
  off: { name: "关闭", color: "#7b7d80" },
} as const;
export type StylusLight = keyof typeof stylusLights;
export const playbackModes = {
  repeat: { name: "列表循环", icon: "repeat" },
  single: { name: "单曲循环", icon: "repeat-one" },
  shuffle: { name: "随机播放", icon: "shuffle" },
} as const;
export type PlaybackMode = keyof typeof playbackModes;
export type ScanMode = "incremental" | "full" | "refresh";
export type ScanRules = {
  filterSmall: boolean;
  minSizeKB: number;
  ignoreHidden: boolean;
  includeSubfolders: boolean;
};
export const defaultScanRules: ScanRules = {
  filterSmall: false,
  minSizeKB: 100,
  ignoreHidden: true,
  includeSubfolders: true,
};
export type ScanProgress = {
  phase:
    | "preparing"
    | "discovering"
    | "reading"
    | "saving"
    | "complete"
    | "cancelled"
    | "failed";
  source: string;
  sourceIndex: number;
  sourceCount: number;
  done: number;
  total: number | null;
  path: string;
};
export type LyricLine = { time: number | null; text: string };
export type Metadata = {
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  genres?: string[];
  track?: number;
  disc?: number;
  format: string;
  duration: number;
  sampleRate?: number;
  bits?: number;
  channels?: number;
  lyrics: LyricLine[];
  artwork?: string;
  artistArtwork?: string;
  warning?: string;
};
export type MusicSource = {
  id: string;
  name: string;
  kind: "managed" | "directory" | "file";
  uri: string;
  bookmark?: string;
};
export type SourceStatus = MusicSource & { error?: string };
export type Track = Metadata & {
  id: string;
  sourceId: string;
  uri: string;
  path: string;
  size: number;
  mtime: number;
  available: boolean;
  favorite: boolean;
};
export type Entry = {
  path: string;
  uri?: string;
  size: number;
  mtime: number;
  lyricUri?: string;
};
export type ScanReport = {
  mode: ScanMode;
  total: number;
  added: number;
  updated: number;
  unchanged: number;
  missing: number;
  filtered?: number;
  errors: { path: string; message: string }[];
  offlineSources?: string[];
  at: number;
};
export type Preferences = {
  home: HomeStyle;
  player: PlayerStyle;
  record: RecordStyle;
  recordSpeed: RecordSpeed;
  tonearmStyle: TonearmStyle;
  cartridgeColor: CartridgeColor;
  stylusLight: StylusLight;
  lastTrack?: string;
  largeLyrics: boolean;
  playbackMode: PlaybackMode;
  backgroundPlayback: boolean;
  scanRules: ScanRules;
  equalizer: EqualizerSettings;
  albumLayout: "cards" | "list";
  artistLayout: "cards" | "list";
};
export const defaults: Preferences = {
  home: "gallery",
  player: "cover",
  record: "clear",
  recordSpeed: "standard",
  tonearmStyle: "simple",
  cartridgeColor: "original",
  stylusLight: "ruby",
  largeLyrics: false,
  playbackMode: "repeat",
  backgroundPlayback: true,
  scanRules: defaultScanRules,
  equalizer: defaultEqualizer,
  albumLayout: "cards",
  artistLayout: "cards",
};
export const audioExtensions = new Set([
  "flac",
  "wav",
  "wave",
  "dsf",
  "dff",
  "aif",
  "aiff",
  "m4a",
  "alac",
  "ape",
  "wv",
  "mp3",
  "aac",
  "ogg",
  "opus",
]);
export const extension = (path: string) =>
  path.split(".").pop()?.toLowerCase() || "";
export const isAudio = (path: string) => audioExtensions.has(extension(path));
export const canPlay = (track: Track) =>
  track.available && !["DSF", "DFF", "APE", "WV"].includes(track.format);
export function fallbackMetadata(path: string): Metadata {
  return {
    title: path
      .split("/")
      .pop()!
      .replace(/\.[^.]+$/, ""),
    artist: "未知艺术家",
    album: "未命名专辑",
    format: extension(path).toUpperCase(),
    duration: 0,
    lyrics: [],
  };
}
