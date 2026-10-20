import type { Database } from "./library";
import type { Metadata } from "./types";

export type ListeningEvent = {
  id: string;
  trackId: string;
  startedAt: number;
  updatedAt: number;
  duration: number;
  listenedSeconds: number;
  coveredSeconds: number;
  reason: string;
  seekCount: number;
  revision: number;
};
export type ListeningEntry = ListeningEvent & {
  completion: number | null;
  metadata: Pick<Metadata, "title" | "artist" | "album" | "genres">;
};
export type ListeningProfile = {
  tracks: Record<string, number>;
  artists: Record<string, number>;
  genres: Record<string, number>;
};
export const emptyProfile = (): ListeningProfile => ({
  tracks: {},
  artists: {},
  genres: {},
});
export function listeningScore(entry: ListeningEvent) {
  const completion =
    entry.duration > 0 ? entry.coveredSeconds / entry.duration : 0;
  // A short accidental tap is weak evidence; interruptions and seeks aren't dislikes.
  const skipped =
    ["skip", "selected"].includes(entry.reason) &&
    entry.seekCount === 0 &&
    entry.listenedSeconds < Math.min(30, entry.duration * 0.2);
  return skipped
    ? -0.35
    : completion >= 0.9
      ? 2
      : completion >= 0.5
        ? 0.75
        : entry.listenedSeconds >= 30
          ? 0.2
          : 0;
}
function validEvent(value: ListeningEvent) {
  return (
    value &&
    typeof value.id === "string" &&
    /^[\w-]{1,100}$/.test(value.id) &&
    typeof value.trackId === "string" &&
    value.trackId.length > 0 &&
    [
      "startedAt",
      "updatedAt",
      "duration",
      "listenedSeconds",
      "coveredSeconds",
      "seekCount",
      "revision",
    ].every(
      (key) =>
        typeof value[key as keyof ListeningEvent] === "number" &&
        Number.isFinite(value[key as keyof ListeningEvent]) &&
        Number(value[key as keyof ListeningEvent]) >= 0,
    ) &&
    value.updatedAt >= value.startedAt &&
    value.coveredSeconds <= value.duration + 0.01 &&
    typeof value.reason === "string"
  );
}
export class ListeningHistory {
  constructor(private db: Database) {}
  async init() {
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS listening_history (
        id TEXT PRIMARY KEY, track_id TEXT NOT NULL, started_at REAL NOT NULL, updated_at REAL NOT NULL,
        duration REAL NOT NULL, listened_seconds REAL NOT NULL, covered_seconds REAL NOT NULL,
        reason TEXT NOT NULL, seek_count INTEGER NOT NULL, revision INTEGER NOT NULL, metadata TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS listening_recent ON listening_history(started_at DESC);
      CREATE INDEX IF NOT EXISTS listening_track ON listening_history(track_id, started_at DESC);
    `);
  }
  async ingest(events: ListeningEvent[]) {
    const accepted = events.filter(validEvent);
    // Idempotent snapshots: a retry after SQLite commit but before native ack is safe.
    for (const event of accepted) {
      const track = await this.db.getFirstAsync<{ metadata: string }>(
        "SELECT metadata FROM tracks WHERE id=?",
        event.trackId,
      );
      const tags = track ? JSON.parse(track.metadata) : {};
      const metadata = JSON.stringify({
        title: tags.title || "曲库外的歌曲",
        artist: tags.artist || "未知艺术家",
        album: tags.album || "",
        genres: tags.genres || [],
      });
      await this.db.runAsync(
        `INSERT INTO listening_history VALUES (?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at,duration=excluded.duration,
        listened_seconds=excluded.listened_seconds,covered_seconds=excluded.covered_seconds,
        reason=excluded.reason,seek_count=excluded.seek_count,revision=excluded.revision
        WHERE excluded.revision > listening_history.revision`,
        event.id,
        event.trackId,
        event.startedAt,
        event.updatedAt,
        event.duration,
        event.listenedSeconds,
        event.coveredSeconds,
        event.reason,
        event.seekCount,
        event.revision,
        metadata,
      );
    }
    return accepted.map(({ id, revision }) => ({ id, revision }));
  }
  async recent(limit = 60, offset = 0): Promise<ListeningEntry[]> {
    const rows = await this.db.getAllAsync<any>(
      "SELECT * FROM listening_history ORDER BY started_at DESC, id DESC LIMIT ? OFFSET ?",
      limit,
      offset,
    );
    return rows.map((row) => ({
      id: row.id,
      trackId: row.track_id,
      startedAt: row.started_at,
      updatedAt: row.updated_at,
      duration: row.duration,
      listenedSeconds: row.listened_seconds,
      coveredSeconds: row.covered_seconds,
      reason: row.reason,
      seekCount: row.seek_count,
      revision: row.revision,
      completion:
        row.duration > 0
          ? Math.min(1, row.covered_seconds / row.duration)
          : null,
      metadata: JSON.parse(row.metadata),
    }));
  }
  async summary() {
    return (await this.db.getFirstAsync<{
      plays: number;
      seconds: number;
      completed: number;
    }>(
      `SELECT count(*) AS plays, coalesce(sum(listened_seconds),0) AS seconds,
       coalesce(sum(CASE WHEN duration>0 AND covered_seconds/duration>=0.9 THEN 1 ELSE 0 END),0) AS completed
       FROM listening_history`,
    ))!;
  }
  async profile(now = Date.now()): Promise<ListeningProfile> {
    // Keep full history; use only recent evidence for recommendations.
    const rows = await this.db.getAllAsync<any>(
      `
      SELECT h.track_id, coalesce(t.metadata,h.metadata) AS metadata,
      sum((CASE WHEN h.reason IN ('skip','selected') AND h.seek_count=0
          AND h.listened_seconds<min(30,h.duration*0.2) THEN -0.35
        WHEN h.duration>0 AND h.covered_seconds/h.duration>=0.9 THEN 2
        WHEN h.duration>0 AND h.covered_seconds/h.duration>=0.5 THEN 0.75
        WHEN h.listened_seconds>=30 THEN 0.2 ELSE 0 END) *
        (CASE WHEN h.started_at>=? THEN 1 ELSE 0.5 END)) AS score
      FROM listening_history h LEFT JOIN tracks t ON t.id=h.track_id WHERE h.started_at>=?
      GROUP BY h.track_id`,
      now - 30 * 86400000,
      now - 90 * 86400000,
    );
    const result = emptyProfile();
    for (const row of rows) {
      // Looping one track must not overwhelm the rest of the library.
      const score = Math.max(-2, Math.min(6, row.score)),
        tags = JSON.parse(row.metadata);
      result.tracks[row.track_id] = score;
      const artist = String(tags.artist || "").trim();
      if (artist && !/^(未知|unknown)/i.test(artist))
        result.artists[artist] = (result.artists[artist] || 0) + score;
      for (const genre of new Set<string>(
        (tags.genres || [])
          .map((g: string) => g.trim().toLowerCase())
          .filter(Boolean),
      ))
        result.genres[genre] = (result.genres[genre] || 0) + score;
    }
    return result;
  }
}
