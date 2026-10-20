import { defaults, type Preferences } from "./types";
import { normalizeEqualizer } from "./equalizer";
import { normalizeScanRules } from "./scanRules";

export function normalizePreferences(input: unknown): Preferences {
  const p =
    input && typeof input === "object" ? (input as Partial<Preferences>) : {};
  const choice = <T extends string>(
    v: unknown,
    values: readonly T[],
    fallback: T,
  ): T => (values.includes(v as T) ? (v as T) : fallback);
  return {
    home: choice(p.home, ["gallery", "library", "quiet"], defaults.home),
    player: choice(p.player, ["cover", "vinyl", "immersive"], defaults.player),
    record: choice(
      p.record,
      [
        "black",
        "clear",
        "matte",
        "pearl",
        "dusk",
        "aurora",
        "amber",
        "rose",
        "jade",
      ],
      defaults.record,
    ),
    recordSpeed: choice(
      p.recordSpeed,
      ["slow", "standard", "fast"],
      defaults.recordSpeed,
    ),
    tonearmStyle: choice(
      p.tonearmStyle,
      ["simple", "classic"],
      defaults.tonearmStyle,
    ),
    cartridgeColor: choice(
      p.cartridgeColor,
      ["original", "silver", "gold", "wine", "ice", "jade"],
      defaults.cartridgeColor,
    ),
    stylusLight: choice(
      p.stylusLight,
      ["ruby", "amber", "ice", "off"],
      defaults.stylusLight,
    ),
    lastTrack: typeof p.lastTrack === "string" ? p.lastTrack : undefined,
    largeLyrics:
      typeof p.largeLyrics === "boolean" ? p.largeLyrics : defaults.largeLyrics,
    playbackMode: choice(
      p.playbackMode,
      ["repeat", "single", "shuffle"],
      defaults.playbackMode,
    ),
    backgroundPlayback:
      typeof p.backgroundPlayback === "boolean"
        ? p.backgroundPlayback
        : defaults.backgroundPlayback,
    albumLayout: choice(p.albumLayout, ["cards", "list"], defaults.albumLayout),
    artistLayout: choice(
      p.artistLayout,
      ["cards", "list"],
      defaults.artistLayout,
    ),
    scanRules: normalizeScanRules(p.scanRules || undefined),
    equalizer: normalizeEqualizer(p.equalizer),
  };
}
