import type { Track } from "./types";

// Metadata-only changes (including favorites) do not invalidate native sources.
export function samePlaybackSources(a: Track[], b: Track[]) {
  return (
    a.length === b.length &&
    a.every((track, index) => {
      const other = b[index];
      return (
        track.id === other.id &&
        track.uri === other.uri &&
        track.sourceId === other.sourceId &&
        track.path === other.path &&
        track.size === other.size &&
        track.mtime === other.mtime &&
        track.available === other.available
      );
    })
  );
}

// Yield between bounded bridge batches so navigation and later taps can run.
export async function addQueueSources<T>(
  sources: T[],
  add: (source: T) => void,
  isCurrent: () => boolean,
  yieldUI = () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
  now = Date.now,
) {
  let batchStart = 0;
  let batchSize = 24;
  for (let index = 0; index < sources.length; index++) {
    // Slow devices must not wait for all 24 native calls before handling a tap.
    if (batchSize >= 24 || now() - batchStart >= 6) {
      await yieldUI();
      if (!isCurrent()) return false;
      batchStart = now();
      batchSize = 0;
    }
    if (!isCurrent()) return false;
    add(sources[index]);
    batchSize++;
  }
  return isCurrent();
}

/** Serialize disk writes, but show every tap immediately. Roll back only the latest failure. */
export class FavoriteUpdates {
  private entries = new Map<
    string,
    {
      desired: boolean;
      confirmed: boolean;
      revision: number;
      write: Promise<void>;
    }
  >();

  toggle(
    id: string,
    current: boolean,
    show: (value: boolean) => void,
    persist: (value: boolean) => Promise<void>,
    failed: (error: unknown) => void,
  ) {
    const entry = this.entries.get(id) ?? {
      desired: current,
      confirmed: current,
      revision: 0,
      write: Promise.resolve(),
    };
    this.entries.set(id, entry);
    const value = !entry.desired;
    entry.desired = value;
    const revision = ++entry.revision;
    show(value);
    entry.write = entry.write.then(async () => {
      try {
        await persist(value);
        entry.confirmed = value;
      } catch (error) {
        if (entry.revision === revision) show(entry.confirmed);
        failed(error);
      } finally {
        if (entry.revision === revision) this.entries.delete(id);
      }
    });
    return entry.write;
  }
}

export function sameFields<T extends object>(previous: T, next: T): boolean {
  return (Object.keys(next) as (keyof T)[]).every((key) =>
    Object.is(previous[key], next[key]),
  );
}

/** Progress/duration/trackCount do not invalidate library, settings or navigation. */
export function playbackSummary(status: {
  currentIndex: number;
  playing: boolean;
  isLoaded: boolean;
  isBuffering: boolean;
}) {
  return {
    currentIndex: status.currentIndex,
    playing: status.playing,
    isLoaded: status.isLoaded,
    isBuffering: status.isBuffering,
  };
}
