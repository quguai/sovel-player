import { atomic, type Database } from "./database";
import {
  fallbackMetadata,
  type Metadata,
  type Track,
  type MusicSource,
} from "./types";
import { isLossless, releaseIdentity, songIdentity } from "./aggregation";
export type CatalogQuery = {
  query?: string;
  artistAlbumsOf?: string;
  favorites?: boolean;
  sourceIds?: string[];
  kind?: "tracks" | "albums" | "artists" | "folders";
  collection?: string;
  collectionKind?: "albums" | "artists" | "folders";
  offset?: number;
  limit?: number;
  dsf?: boolean;
};
type Copy = { id: string; source_id: string; path: string; metadata: string };
type Row = {
  id: string;
  source_id: string;
  uri: string;
  path: string;
  size: number;
  mtime: number;
  available: number;
  favorite: number;
  summary: string;
  song_key: string;
  release_key: string;
  copy_count?: number;
  collection_count?: number;
  collection_key?: string;
  name?: string;
  kind?: MusicSource["kind"];
};
export class Catalog {
  private fullText = false;
  private unavailable = new Set<string>();
  setSourceAvailability(id: string, available: boolean) {
    if (available) this.unavailable.delete(id);
    else this.unavailable.add(id);
  }
  constructor(private db: Database) {}
  async init() {
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS source_options (source_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1, priority INTEGER NOT NULL DEFAULT 100, config TEXT, synced_at REAL NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS catalog_copies (track_id TEXT PRIMARY KEY, song_key TEXT NOT NULL, release_key TEXT NOT NULL, title TEXT NOT NULL, artist TEXT NOT NULL, album TEXT NOT NULL, folder TEXT NOT NULL, search_text TEXT NOT NULL, summary TEXT NOT NULL, lossless INTEGER NOT NULL, format TEXT NOT NULL, disc INTEGER NOT NULL, track INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS catalog_song ON catalog_copies(song_key);
      CREATE INDEX IF NOT EXISTS catalog_album ON catalog_copies(release_key,disc,track);
      CREATE INDEX IF NOT EXISTS catalog_artist ON catalog_copies(artist,title);
      CREATE INDEX IF NOT EXISTS catalog_title ON catalog_copies(title,track_id);
      CREATE TABLE IF NOT EXISTS song_preferences (song_key TEXT PRIMARY KEY, preferred_copy TEXT);
      CREATE TABLE IF NOT EXISTS remote_stage (job TEXT NOT NULL, source_id TEXT NOT NULL, item_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(job,item_id));
      DELETE FROM remote_stage;
    `);
    // Trigram search accelerates substring matching. Short terms (including
    // one/two-character Chinese queries) retain the exact substring fallback.
    try {
      const exists = await this.db.getFirstAsync(
        "SELECT 1 FROM sqlite_master WHERE name='catalog_search'",
      );
      await this.db
        .execAsync(`CREATE VIRTUAL TABLE IF NOT EXISTS catalog_search USING fts5(track_id UNINDEXED,search_text,content='catalog_copies',content_rowid='rowid',tokenize='trigram');
        CREATE TRIGGER IF NOT EXISTS catalog_search_insert AFTER INSERT ON catalog_copies BEGIN INSERT INTO catalog_search(rowid,track_id,search_text) VALUES(new.rowid,new.track_id,new.search_text); END;
        CREATE TRIGGER IF NOT EXISTS catalog_search_delete AFTER DELETE ON catalog_copies BEGIN INSERT INTO catalog_search(catalog_search,rowid,track_id,search_text) VALUES('delete',old.rowid,old.track_id,old.search_text); END;
        CREATE TRIGGER IF NOT EXISTS catalog_search_update AFTER UPDATE ON catalog_copies BEGIN INSERT INTO catalog_search(catalog_search,rowid,track_id,search_text) VALUES('delete',old.rowid,old.track_id,old.search_text); INSERT INTO catalog_search(rowid,track_id,search_text) VALUES(new.rowid,new.track_id,new.search_text); END;`);
      if (!exists)
        await this.db.execAsync(
          "INSERT INTO catalog_search(catalog_search) VALUES('rebuild')",
        );
      this.fullText = true;
    } catch {
      this.fullText = false;
    }
    // Resumable, additive migration: existing IDs, favorite rows and checkpoints stay intact.
    for (;;) {
      const batch = await this.db.getAllAsync<Copy>(
        "SELECT t.id,t.source_id,t.path,t.metadata FROM tracks t LEFT JOIN catalog_copies c ON c.track_id=t.id WHERE c.track_id IS NULL LIMIT 64",
      );
      if (!batch.length) break;
      await atomic(this.db, (transaction) =>
        new Catalog(transaction).index(batch),
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  async index(copies: Copy[]) {
    if (!copies.length) return;
    const params = copies.flatMap((copy) => {
      let tags: Metadata;
      try {
        tags = JSON.parse(copy.metadata);
      } catch {
        tags = fallbackMetadata(copy.path);
      }
      const { lyrics: _lyrics, ...summary } = tags;
      return [
        copy.id,
        songIdentity(tags, copy.id),
        releaseIdentity(tags),
        tags.title,
        tags.artist,
        tags.album,
        `${copy.source_id}\u0000${copy.path.split("/").slice(0, -1).join("/")}`,
        `${tags.title} ${tags.artist} ${tags.album} ${copy.path}`
          .normalize("NFKC")
          .toLowerCase(),
        JSON.stringify(summary),
        Number(tags.lossless ?? isLossless(tags.format)),
        tags.format.toUpperCase(),
        tags.disc || 1,
        tags.track || 0,
      ];
    });
    await this.db.runAsync(
      `INSERT INTO catalog_copies VALUES ${copies.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",")} ON CONFLICT(track_id) DO UPDATE SET song_key=excluded.song_key,release_key=excluded.release_key,title=excluded.title,artist=excluded.artist,album=excluded.album,folder=excluded.folder,search_text=excluded.search_text,summary=excluded.summary,lossless=excluded.lossless,format=excluded.format,disc=excluded.disc,track=excluded.track`,
      ...params,
    );
  }
  private selection(q: CatalogQuery) {
    const conditions = ["COALESCE(o.enabled,1)=1"];
    const params: (string | number)[] = [...this.unavailable];
    if (q.sourceIds?.length) {
      conditions.push(
        `t.source_id IN (${q.sourceIds.map(() => "?").join(",")})`,
      );
      params.push(...q.sourceIds);
    }
    if (q.artistAlbumsOf) {
      conditions.push(
        "c.release_key IN (SELECT release_key FROM catalog_copies WHERE artist=?)",
      );
      params.push(q.artistAlbumsOf);
    }
    if (q.query?.trim()) {
      const term = q.query.trim().normalize("NFKC").toLowerCase();
      if (this.fullText && [...term].length >= 3) {
        conditions.push(
          "c.track_id IN (SELECT track_id FROM catalog_search WHERE catalog_search MATCH ?)",
        );
        params.push(`"${term.replace(/"/g, '\"\"')}"`);
      } else {
        conditions.push("instr(c.search_text,?)>0");
        params.push(term);
      }
    }
    if (q.collection) {
      const column =
        q.collectionKind === "artists"
          ? "c.artist"
          : q.collectionKind === "folders"
            ? "c.folder"
            : "c.release_key";
      conditions.push(`${column}=?`);
      params.push(q.collection);
    }
    const favorite =
      "EXISTS(SELECT 1 FROM favorites f JOIN catalog_copies fc ON fc.track_id=f.track_id WHERE fc.song_key=c.song_key)";
    if (q.favorites) conditions.push(favorite);
    const supported = q.dsf
      ? "c.format NOT IN ('DFF','APE','WV')"
      : "c.format NOT IN ('DSF','DFF','APE','WV')";
    const health = this.unavailable.size
      ? `LEFT JOIN (${[...this.unavailable].map((_, i) => (i === 0 ? "SELECT ? AS id" : "SELECT ?")).join(" UNION ALL ")}) health ON health.id=t.source_id`
      : "LEFT JOIN (SELECT NULL AS id) health ON 0";
    const available = "(t.available AND health.id IS NULL)";
    return {
      params,
      sql: `WITH ranked AS (
      SELECT t.id,t.source_id,t.uri,t.path,t.size,t.mtime,${available} AS available,c.*,s.name,s.kind,${favorite} AS favorite,
      COUNT(*) OVER(PARTITION BY c.song_key) AS copy_count,
      ROW_NUMBER() OVER(PARTITION BY c.song_key ORDER BY ${available} DESC, (${supported}) DESC, (t.id=COALESCE(p.preferred_copy,'')) DESC,c.lossless DESC,(s.kind IN ('managed','directory','file')) DESC,COALESCE(o.priority,100) ASC,COALESCE(json_extract(c.summary,'$.bits'),0) DESC,COALESCE(json_extract(c.summary,'$.sampleRate'),0) DESC,t.id ASC) AS rank
      FROM tracks t JOIN catalog_copies c ON c.track_id=t.id JOIN sources s ON s.id=t.source_id
      LEFT JOIN source_options o ON o.source_id=s.id LEFT JOIN song_preferences p ON p.song_key=c.song_key ${health}
      WHERE ${conditions.join(" AND ")}
    ), chosen AS (SELECT * FROM ranked WHERE rank=1) `,
    };
  }
  async page(q: CatalogQuery = {}) {
    const { sql, params } = this.selection(q);
    const kind = q.kind || "tracks";
    const grouped = kind !== "tracks";
    const key =
      kind === "albums"
        ? "release_key"
        : kind === "artists"
          ? "artist"
          : "folder";
    const pageSql = grouped
      ? `, collections AS (SELECT *,COUNT(*) OVER(PARTITION BY ${key}) AS collection_count,${key} AS collection_key, ROW_NUMBER() OVER(PARTITION BY ${key} ORDER BY disc,track,title,id) AS collection_rank FROM chosen) SELECT * FROM collections WHERE collection_rank=1 ORDER BY ${kind === "albums" ? "album" : key} COLLATE NOCASE,collection_key`
      : "SELECT * FROM chosen ORDER BY release_key,disc,track,title COLLATE NOCASE,id";
    const count = await this.db.getFirstAsync<{ n: number }>(
      sql +
        `SELECT COUNT(${grouped ? `DISTINCT ${key}` : "*"}) AS n FROM chosen`,
      ...params,
    );
    const rows = await this.db.getAllAsync<Row>(
      sql + pageSql + " LIMIT ? OFFSET ?",
      ...params,
      Math.min(200, Math.max(1, q.limit || 80)),
      Math.max(0, q.offset || 0),
    );
    return { items: rows.map((r) => this.track(r)), total: count?.n || 0 };
  }
  private track(row: Row): Track {
    return {
      ...JSON.parse(row.summary),
      lyrics: [],
      hydrated: false,
      id: row.id,
      sourceId: row.source_id,
      uri: row.uri,
      path: row.path,
      size: row.size,
      mtime: row.mtime,
      available: !!row.available,
      favorite: !!row.favorite,
      songKey: row.song_key,
      releaseKey: row.release_key,
      copyCount: row.copy_count || 1,
      collectionCount: row.collection_count,
      collectionKey: row.collection_key,
      sourceName: row.name,
      sourceKind: row.kind,
    };
  }
  async completeAlbumSource(releaseKey: string, dsf = false) {
    const pinned = await this.db.getFirstAsync(
      "SELECT 1 FROM song_preferences p JOIN catalog_copies c ON c.song_key=p.song_key WHERE c.release_key=? AND p.preferred_copy IS NOT NULL",
      releaseKey,
    );
    if (pinned) return undefined;
    const { sql, params } = this.selection({
      collection: releaseKey,
      collectionKind: "albums",
      dsf,
    });
    const row = await this.db.getFirstAsync<{ source_id: string }>(
      sql +
        `SELECT source_id,COUNT(DISTINCT song_key) AS n,MIN(lossless) AS quality FROM ranked WHERE available=1 AND format NOT IN (${dsf ? "'DFF','APE','WV'" : "'DSF','DFF','APE','WV'"}) GROUP BY source_id HAVING n=(SELECT COUNT(*) FROM chosen) ORDER BY quality DESC,(kind IN ('managed','directory','file')) DESC,COALESCE((SELECT priority FROM source_options WHERE source_id=ranked.source_id),100) ASC,source_id LIMIT 1`,
      ...params,
    );
    return row?.source_id;
  }
  async copies(songKey: string) {
    const rows = await this.db.getAllAsync<Row>(
      `SELECT t.*,c.summary,c.song_key,c.release_key,s.name,s.kind,EXISTS(SELECT 1 FROM favorites f JOIN catalog_copies fc ON fc.track_id=f.track_id WHERE fc.song_key=c.song_key) AS favorite FROM catalog_copies c JOIN tracks t ON t.id=c.track_id JOIN sources s ON s.id=t.source_id LEFT JOIN source_options o ON o.source_id=s.id WHERE c.song_key=? AND COALESCE(o.enabled,1)=1 ORDER BY t.available DESC,c.lossless DESC,(s.kind IN ('managed','directory','file')) DESC,COALESCE(o.priority,100),t.id`,
      songKey,
    );
    return rows.map((r) => this.track(r));
  }
  async prefer(songKey: string, copyId: string | null) {
    if (
      copyId &&
      !(await this.db.getFirstAsync(
        "SELECT 1 FROM catalog_copies WHERE song_key=? AND track_id=?",
        songKey,
        copyId,
      ))
    )
      throw new Error("版本不属于当前歌曲");
    await this.db.runAsync(
      "INSERT INTO song_preferences VALUES (?,?) ON CONFLICT(song_key) DO UPDATE SET preferred_copy=excluded.preferred_copy",
      songKey,
      copyId,
    );
  }
  async favorite(id: string, selected: boolean) {
    // Preserve the existing favorites table, so old clients, backups and IDs remain valid.
    if (selected)
      await this.db.runAsync(
        "INSERT OR IGNORE INTO favorites SELECT track_id FROM catalog_copies WHERE song_key=(SELECT song_key FROM catalog_copies WHERE track_id=?)",
        id,
      );
    else
      await this.db.runAsync(
        "DELETE FROM favorites WHERE track_id IN (SELECT track_id FROM catalog_copies WHERE song_key=(SELECT song_key FROM catalog_copies WHERE track_id=?))",
        id,
      );
  }
  async sources() {
    const rows = await this.db.getAllAsync<
      Omit<MusicSource, "enabled" | "config"> & {
        enabled: number;
        config: string | null;
      }
    >(
      `SELECT s.*,COALESCE(o.enabled,1) AS enabled,COALESCE(o.priority,100) AS priority,o.config,COALESCE(o.synced_at,0) AS syncedAt,(SELECT COUNT(*) FROM tracks t WHERE t.source_id=s.id AND t.available=1) AS trackCount FROM sources s LEFT JOIN source_options o ON o.source_id=s.id ORDER BY priority,s.rowid`,
    );
    return rows.map((r) => ({
      ...r,
      enabled: !!r.enabled,
      config: r.config ? JSON.parse(r.config) : undefined,
    })) as MusicSource[];
  }
  async configureSource(
    id: string,
    patch: {
      enabled?: boolean;
      priority?: number;
      config?: MusicSource["config"];
      syncedAt?: number;
    },
  ) {
    await this.db.runAsync(
      "INSERT OR IGNORE INTO source_options(source_id) VALUES (?)",
      id,
    );
    for (const [key, value] of Object.entries(patch)) {
      const column = {
        enabled: "enabled",
        priority: "priority",
        config: "config",
        syncedAt: "synced_at",
      }[key];
      if (!column || value === undefined) continue;
      await this.db.runAsync(
        `UPDATE source_options SET ${column}=? WHERE source_id=?`,
        key === "config"
          ? JSON.stringify(value)
          : key === "enabled"
            ? Number(value)
            : value,
        id,
      );
    }
  }
  async byIds(ids: string[]) {
    const result: Track[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const rows = await this.db.getAllAsync<Row>(
        `SELECT t.*,c.summary,c.song_key,c.release_key,s.name,s.kind,EXISTS(SELECT 1 FROM favorites f JOIN catalog_copies fc ON fc.track_id=f.track_id WHERE fc.song_key=c.song_key) AS favorite FROM tracks t JOIN catalog_copies c ON c.track_id=t.id JOIN sources s ON s.id=t.source_id WHERE t.id IN (${batch.map(() => "?").join(",")})`,
        ...batch,
      );
      result.push(...rows.map((r) => this.track(r)));
    }
    return result;
  }
  async detail(id: string): Promise<Track | undefined> {
    const [item] = await this.byIds([id]);
    const row = await this.db.getFirstAsync<{ metadata: string }>(
      "SELECT metadata FROM tracks WHERE id=?",
      id,
    );
    if (!item || !row) return;
    let tags: Metadata;
    try {
      tags = JSON.parse(row.metadata);
    } catch {
      tags = fallbackMetadata(item.path);
    }
    return {
      ...item,
      ...tags,
      hydrated: true,
      copyCount: (await this.copies(item.songKey!)).length || 1,
    };
  }
}
