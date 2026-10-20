import { requireOptionalNativeModule } from "expo";
import type { AudioPlaylist } from "expo-audio";
import type { PlaybackCheckpoint } from "../core/playbackSession";
import type { ListeningEvent } from "../core/listeningHistory";
const native = requireOptionalNativeModule<{
  getSovelPlaybackCheckpoint?: () => PlaybackCheckpoint;
  getSovelListeningEvents?: () => ListeningEvent[];
  ackSovelListeningEvents?: (
    entries: { id: string; revision: number }[],
  ) => void;
}>("ExpoAudio");
export type SleepState = {
  available: boolean;
  active: boolean;
  remaining: number;
  seconds: number;
  expired: boolean;
};
export const noSleep: SleepState = {
  available: false,
  active: false,
  remaining: 0,
  seconds: 0,
  expired: false,
};
export type SovelPlaylist = AudioPlaylist & {
  setSovelQueueToken?: (token: string) => void;
  flushSovelCheckpoint?: () => void;
  setSovelSleepTimer?: (seconds: number) => void;
  getSovelSleepState?: () => SleepState;
  bindSovelListeningQueue?: (ids: string[]) => void;
  finishSovelListening?: (reason: string) => void;
};
export const listeningAvailable = () =>
  !!native?.getSovelListeningEvents && !!native?.ackSovelListeningEvents;
export const pendingListeningEvents = () =>
  native?.getSovelListeningEvents?.() ?? [];
export const acknowledgeListeningEvents = (
  entries: { id: string; revision: number }[],
) => native?.ackSovelListeningEvents?.(entries);
export function readPlaybackCheckpoint() {
  return native?.getSovelPlaybackCheckpoint?.() ?? null;
}
export function sleepState(playlist: SovelPlaylist): SleepState {
  return playlist.getSovelSleepState?.() ?? noSleep;
}
