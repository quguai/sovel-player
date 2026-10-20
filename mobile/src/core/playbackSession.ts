import { canPlay, type PlaybackMode, type Track } from "./types";

export type PlaybackSession = {
  version: 1;
  token: string;
  queueIds: string[];
  originalIds: string[];
  nativeIds: string[];
  currentId: string;
  position: number;
  mode: PlaybackMode;
};
export type PlaybackCheckpoint = {
  token: string;
  index: number;
  position: number;
};
export function checkpointFor(
  saved: PlaybackSession,
  ...candidates: unknown[]
): PlaybackCheckpoint | undefined {
  return candidates.find((value): value is PlaybackCheckpoint => {
    if (!value || typeof value !== "object") return false;
    const c = value as PlaybackCheckpoint;
    return (
      c.token === saved.token &&
      Number.isInteger(c.index) &&
      c.index >= 0 &&
      c.index < saved.nativeIds.length &&
      Number.isFinite(c.position) &&
      c.position >= 0
    );
  });
}
// Mode changes reorder the playable projection without forgetting offline entries.
export function reorderedSessionIds(
  saved: PlaybackSession,
  visibleIds: string[],
  shuffle: boolean,
) {
  const visible = new Set(visibleIds),
    original = new Set(saved.originalIds);
  const originalIds = [
    ...saved.originalIds,
    ...saved.queueIds.filter((id) => !original.has(id)),
  ];
  return {
    originalIds,
    queueIds: shuffle
      ? [...visibleIds, ...saved.queueIds.filter((id) => !visible.has(id))]
      : originalIds,
  };
}
const ids = (value: unknown): string[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is string => typeof id === "string" && id.length > 0,
          ),
        ),
      ].slice(0, 50000)
    : [];
export function normalizeSession(value: unknown): PlaybackSession | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Partial<PlaybackSession>;
  if (s.version !== 1 || typeof s.token !== "string") return null;
  const queueIds = ids(s.queueIds);
  if (!queueIds.length) return null;
  return {
    version: 1,
    token: s.token,
    queueIds,
    originalIds: ids(s.originalIds),
    nativeIds: ids(s.nativeIds),
    currentId: typeof s.currentId === "string" ? s.currentId : queueIds[0],
    position: Number.isFinite(s.position) ? Math.max(0, s.position!) : 0,
    mode: s.mode === "single" || s.mode === "shuffle" ? s.mode : "repeat",
  };
}
export function restoreSession(
  saved: PlaybackSession,
  tracks: Track[],
  checkpoint?: PlaybackCheckpoint | null,
) {
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const validCheckpoint = checkpointFor(saved, checkpoint);
  const wanted = validCheckpoint
    ? saved.nativeIds[checkpoint!.index]
    : saved.currentId;
  const ordered = saved.queueIds
    .map((id) => byId.get(id))
    .filter((t): t is Track => !!t && canPlay(t));
  const start = Math.max(0, saved.queueIds.indexOf(wanted));
  const rotated = [
    ...saved.queueIds.slice(start),
    ...saved.queueIds.slice(0, start),
  ];
  const playable = new Map(ordered.map((t) => [t.id, t]));
  const current = rotated.map((id) => playable.get(id)).find(Boolean);
  const originalSet = new Set(saved.originalIds);
  const position =
    current?.id === wanted
      ? Math.max(0, validCheckpoint ? checkpoint!.position : saved.position)
      : 0;
  // Keep the full saved IDs, including offline sources, outside the native queue.
  return {
    ordered,
    current,
    position: current?.duration
      ? Math.min(position, Math.max(0, current.duration - 0.05))
      : position,
    original: [
      ...saved.originalIds,
      ...saved.queueIds.filter((id) => !originalSet.has(id)),
    ]
      .map((id) => byId.get(id))
      .filter((t): t is Track => !!t && canPlay(t)),
    unavailable: saved.queueIds.length - ordered.length,
  };
}
