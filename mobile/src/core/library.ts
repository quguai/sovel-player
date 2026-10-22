import {
  fallbackMetadata,
  type Entry,
  type Metadata,
  type MusicSource,
  type ScanMode,
  type ScanReport,
  type Track,
  type ScanRules,
} from "./types";
import { excludesEntry } from "./scanRules";
import { syncMediaSource, type RemoteProgress } from "./remoteSync";
import { Catalog } from "./catalog";
import { ListeningHistory } from "./listeningHistory";
import { atomic, type Database } from "./database";
export type { Database } from "./database";
export class Library {
  private scanning = false;
  readonly history: ListeningHistory;
  readonly catalog: Catalog;
  constructor(private db: Database) {
    this.history = new ListeningHistory(db);
    this.catalog = new Catalog(db);
  }
  async init() {
    await this.db.execAsync(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS tracks (id TEXT PRIMARY KEY, source_id TEXT NOT NULL DEFAULT 'local', uri TEXT NOT NULL DEFAULT '', path TEXT NOT NULL, size INTEGER NOT NULL, mtime REAL NOT NULL, metadata TEXT NOT NULL, available INTEGER NOT NULL DEFAULT 1, UNIQUE(source_id,path));
      CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, uri TEXT NOT NULL, bookmark TEXT, UNIQUE(kind,uri));
      CREATE TABLE IF NOT EXISTS favorites (track_id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS lyric_offsets (track_id TEXT PRIMARY KEY, seconds REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS scans (id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT NOT NULL, report TEXT);
      UPDATE scans SET status='interrupted' WHERE status='running';`);
    const columns = await this.db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(tracks)",
    );
    if (!columns.some((c) => c.name === "source_id")) {
      // Preserve existing IDs, favorites and metadata when upgrading the initial prototype.
      await this.db.withTransactionAsync(async () => {
        await this.db.execAsync(`ALTER TABLE tracks RENAME TO tracks_v1;
          CREATE TABLE tracks (id TEXT PRIMARY KEY, source_id TEXT NOT NULL DEFAULT 'local', uri TEXT NOT NULL DEFAULT '', path TEXT NOT NULL, size INTEGER NOT NULL, mtime REAL NOT NULL, metadata TEXT NOT NULL, available INTEGER NOT NULL DEFAULT 1, UNIQUE(source_id,path));
          INSERT INTO tracks(id,path,size,mtime,metadata,available) SELECT id,path,size,mtime,metadata,available FROM tracks_v1;
          DROP TABLE tracks_v1;`);
      });
    }
    await this.history.init();

    await this.saveSource({
      id: "local",
      name: "Sovel 应用文件",
      kind: "managed",
      uri: "sovel:music",
    });
    await this.catalog.init();
    await this.db.execAsync("PRAGMA user_version=5");
  }
  async syncRemote(
    source: MusicSource,
    token: string,
    signal: AbortSignal,
    progress: (p: RemoteProgress) => void,
  ) {
    if (this.scanning) throw new Error("扫描正在进行");
    this.scanning = true;
    try {
      return await syncMediaSource(this.db, source, token, signal, progress);
    } finally {
      this.scanning = false;
    }
  }
  async sources(): Promise<MusicSource[]> {
    return this.catalog.sources();
  }
  async saveSource(source: MusicSource): Promise<MusicSource> {
    const existing = await this.db.getFirstAsync<MusicSource>(
      "SELECT * FROM sources WHERE kind=? AND uri=?",
      source.kind,
      source.uri,
    );
    const next = { ...source, id: existing?.id || source.id };
    await this.db.runAsync(
      "INSERT INTO sources(id,name,kind,uri,bookmark) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,uri=excluded.uri,bookmark=excluded.bookmark",
      next.id,
      next.name,
      next.kind,
      next.uri,
      next.bookmark || null,
    );
    return next;
  }
  async list(): Promise<Track[]> {
    const rows = await this.db.getAllAsync<any>(
      "SELECT t.*, f.track_id AS favorite FROM tracks t LEFT JOIN favorites f ON f.track_id=t.id ORDER BY path",
    );
    const tracks: Track[] = [];
    for (let index = 0; index < rows.length; index++) {
      // Large embedded lyric/tag JSON should not monopolize the UI thread.
      if (index > 0 && index % 100 === 0)
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const row = rows[index];
      let metadata: Metadata;
      try {
        metadata = JSON.parse(row.metadata);
      } catch {
        // One damaged cached tag must not prevent access to the entire library.
        metadata = fallbackMetadata(row.path);
      }
      tracks.push({
        ...metadata,
        id: row.id,
        sourceId: row.source_id,
        uri: row.uri,
        path: row.path,
        size: row.size,
        mtime: row.mtime,
        available: !!row.available,
        favorite: !!row.favorite,
      });
    }
    return tracks;
  }

  async favorite(id: string, selected: boolean) {
    await this.catalog.favorite(id, selected);
    await this.db.runAsync(
      selected
        ? "INSERT OR IGNORE INTO favorites VALUES (?)"
        : "DELETE FROM favorites WHERE track_id=?",
      id,
    );
  }
  async get<T>(key: string, fallback: T): Promise<T> {
    const row = await this.db.getFirstAsync<{ value: string }>(
      "SELECT value FROM preferences WHERE key=?",
      key,
    );
    if (!row) return fallback;
    try {
      return JSON.parse(row.value);
    } catch {
      return fallback;
    }
  }
  async lyricOffsets(): Promise<Record<string, number>> {
    const rows = await this.db.getAllAsync<{
      track_id: string;
      seconds: number;
    }>("SELECT * FROM lyric_offsets");
    return Object.fromEntries(rows.map((r) => [r.track_id, r.seconds]));
  }
  async setLyricOffset(id: string, seconds: number) {
    await this.db.runAsync(
      "INSERT OR REPLACE INTO lyric_offsets VALUES (?,?)",
      id,
      seconds,
    );
  }
  async set(key: string, value: unknown) {
    await this.db.runAsync(
      "INSERT OR REPLACE INTO preferences VALUES (?,?)",
      key,
      JSON.stringify(value),
    );
  }
  async scan(
    mode: ScanMode,
    enumerate: () => Promise<Entry[]>,
    parse: (entry: Entry) => Promise<Metadata>,
    progress: (done: number, total: number, path: string) => void,
    signal?: AbortSignal,
    sourceId = "local",
    rules?: ScanRules,
  ): Promise<ScanReport> {
    if (this.scanning) throw new Error("扫描正在进行");
    this.scanning = true;
    let job: { id: number } | null = null;
    try {
      await this.db.runAsync("INSERT INTO scans(status) VALUES ('running')");
      job = await this.db.getFirstAsync<{ id: number }>(
        "SELECT last_insert_rowid() AS id",
      );
      // Only load the source being scanned, not every library and favorite.
      const rows = await this.db.getAllAsync<{
        id: string;
        path: string;
        size: number;
        mtime: number;
        uri: string;
        metadata: string;
        available: number;
      }>(
        "SELECT id,path,size,mtime,uri,metadata,available FROM tracks WHERE source_id=?",
        sourceId,
      );
      const old = new Map(
        rows.map((row) => [
          row.path,
          {
            ...(JSON.parse(row.metadata) as Metadata),
            id: row.id,
            path: row.path,
            size: row.size,
            mtime: row.mtime,
            uri: row.uri,
            available: !!row.available,
          },
        ]),
      );
      // Enumeration must succeed completely before absence can be interpreted as missing.
      const discovered = await enumerate();
      const entries = rules
        ? discovered.filter((e) => !excludesEntry(e, rules))
        : discovered;
      const seen = new Set(discovered.map((e) => e.path)),
        changed: { entry: Entry; metadata: Metadata; id: string }[] = [];
      const report: ScanReport = {
        mode,
        total: entries.length,
        added: 0,
        updated: 0,
        unchanged: 0,
        missing: 0,
        filtered: discovered.length - entries.length,
        errors: [],
        at: Date.now(),
      };
      progress(0, entries.length, "");
      const reactivated: Entry[] = [];
      let cursor = 0,
        completed = 0,
        stopped = false;
      // Eight parsers bound open handles and concurrent cover buffers. JavaScript
      // still runs on one thread; file I/O can overlap without an unbounded fan-out.
      const worker = async () => {
        let sinceYield = 0,
          lastYield = Date.now();
        try {
          while (!stopped && cursor < entries.length) {
            if (signal?.aborted) throw new Error("扫描已取消，曲库未改动");
            const entry = entries[cursor++];
            const previous = old.get(entry.path);
            if (
              mode === "incremental" &&
              previous &&
              previous.size === entry.size &&
              previous.mtime === entry.mtime &&
              entry.mtime > 0 &&
              !previous.warning
            ) {
              report.unchanged++;
              if (!previous.available || previous.uri !== (entry.uri || ""))
                reactivated.push(entry);
            } else {
              let metadata: Metadata;
              try {
                metadata = await parse(entry);
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : String(error);
                report.errors.push({ path: entry.path, message });
                metadata = {
                  ...(previous || fallbackMetadata(entry.path)),
                  warning: message,
                };
              }
              changed.push({
                entry,
                metadata,
                id: previous?.id || `${sourceId}:${entry.path}`,
              });
              if (previous) report.updated++;
              else report.added++;
            }
            if (signal?.aborted) throw new Error("扫描已取消，曲库未改动");
            if (stopped) return;
            progress(++completed, entries.length, entry.path);
            // Fast unchanged entries do not need a timer each. Yield periodically
            // so cancellation and UI updates can still run on the JS thread.
            if (++sinceYield >= 32 || Date.now() - lastYield >= 16) {
              await new Promise((resolve) => setTimeout(resolve, 0));
              sinceYield = 0;
              lastYield = Date.now();
            }
          }
        } catch (error) {
          stopped = true;
          throw error;
        }
      };
      // Drain in-flight readers even on cancellation/error before releasing the
      // scan lock. No worker can continue writing artwork into a subsequent scan.
      const workers = await Promise.allSettled(
        Array.from({ length: Math.min(8, entries.length) }, worker),
      );
      for (const result of workers)
        if (result.status === "rejected") throw result.reason;
      if (signal?.aborted) throw new Error("扫描已取消，曲库未改动");
      // A narrowed scan scope must not delete or hide previously indexed music.
      const missing = [...old.values()].filter(
        (t) =>
          t.available &&
          !seen.has(t.path) &&
          !(rules && excludesEntry(t, rules)),
      );
      report.missing = missing.length;
      await atomic(this.db, async (transaction) => {
        for (const track of missing)
          await transaction.runAsync(
            "UPDATE tracks SET available=0 WHERE id=?",
            track.id,
          );
        for (const entry of reactivated)
          await transaction.runAsync(
            "UPDATE tracks SET available=1,uri=? WHERE source_id=? AND path=?",
            entry.uri || "",
            sourceId,
            entry.path,
          );
        // Keep each statement below SQLite's conservative 999-parameter limit.
        // One bridge round trip per 64 rows, instead of one per song.
        for (let start = 0; start < changed.length; start += 64) {
          if (signal?.aborted) throw new Error("扫描已取消，曲库未改动");
          const batch = changed.slice(start, start + 64);
          await transaction.runAsync(
            `INSERT INTO tracks(id,source_id,uri,path,size,mtime,metadata,available) VALUES ${batch.map(() => "(?,?,?,?,?,?,?,1)").join(",")}
          ON CONFLICT(source_id,path) DO UPDATE SET size=excluded.size,mtime=excluded.mtime,metadata=excluded.metadata,uri=excluded.uri,available=1`,
            ...batch.flatMap(({ entry, metadata, id }) => [
              id,
              sourceId,
              entry.uri || "",
              entry.path,
              entry.size,
              entry.mtime,
              JSON.stringify(metadata),
            ]),
          );
        }
        for (let start = 0; start < changed.length; start += 64) {
          await new Catalog(transaction).index(
            changed.slice(start, start + 64).map(({ id, entry, metadata }) => ({
              id,
              source_id: sourceId,
              path: entry.path,
              metadata: JSON.stringify(metadata),
            })),
          );
        }
        if (signal?.aborted) throw new Error("扫描已取消，曲库未改动");
        await transaction.runAsync(
          "UPDATE scans SET status='complete',report=? WHERE id=?",
          JSON.stringify(report),
          job!.id,
        );
        await transaction.runAsync(
          "INSERT OR REPLACE INTO preferences VALUES (?,?)",
          "lastScan",
          JSON.stringify(report),
        );
      });
      return report;
    } catch (error) {
      if (job)
        await this.db.runAsync(
          "UPDATE scans SET status=?,report=? WHERE id=?",
          signal?.aborted ? "cancelled" : "failed",
          String(error),
          job.id,
        );
      throw error;
    } finally {
      this.scanning = false;
    }
  }
}
