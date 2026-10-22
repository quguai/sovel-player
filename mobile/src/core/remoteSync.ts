import { atomic, type Database } from "./database";
import { Catalog } from "./catalog";
import { MediaServer } from "./mediaServer";
import { type MusicSource } from "./types";
export type RemoteProgress = {
  sourceId: string;
  phase: "discovering" | "importing";
  done: number;
  total: number | null;
};
/** Stage the complete server listing first. Interrupted listings never hide old tracks. */
export async function syncMediaSource(
  db: Database,
  source: MusicSource,
  token: string,
  signal: AbortSignal,
  progress: (p: RemoteProgress) => void,
  server?: MediaServer,
) {
  if (!source.config || (source.kind !== "jellyfin" && source.kind !== "emby"))
    throw new Error("来源配置不完整");
  const client = server || new MediaServer(source.config.baseUrl, source.kind);
  const job = `${source.id}-${Date.now()}-${Math.random()}`;
  const check = () => {
    if (signal.aborted) throw new Error("同步已取消，原有曲库已保留");
  };
  let offset = 0,
    total: number | null = null;
  progress({ sourceId: source.id, phase: "discovering", done: 0, total });
  try {
    do {
      check();
      const page = await client.items(source.config, token, offset, signal);
      if (total !== null && total !== page.total)
        throw new Error("服务器曲库正在变化，请稍后重新同步");
      total = page.total;
      if (
        (!page.items.length && offset < total) ||
        offset + page.items.length > total
      )
        throw new Error("歌曲分页不完整，原有曲库已保留");
      for (let start = 0; start < page.items.length; start += 64) {
        const batch = page.items.slice(start, start + 64);
        try {
          await db.runAsync(
            `INSERT INTO remote_stage VALUES ${batch.map(() => "(?,?,?,?)").join(",")}`,
            ...batch.flatMap((item) => [
              job,
              source.id,
              item.id,
              JSON.stringify(item),
            ]),
          );
        } catch (error) {
          if (/UNIQUE/i.test(String(error)))
            throw new Error(
              "服务器清单出现重复歌曲，请稍后重新同步；原有曲库已保留",
            );
          throw error;
        }
      }
      offset += page.items.length;
      progress({
        sourceId: source.id,
        phase: "discovering",
        done: offset,
        total,
      });
    } while (total === null || offset < total);
    check();
    progress({ sourceId: source.id, phase: "importing", done: 0, total });
    await atomic(db, async (transaction) => {
      for (let start = 0; start < offset; start += 64) {
        check();
        const rows = await transaction.getAllAsync<{ payload: string }>(
          "SELECT payload FROM remote_stage WHERE job=? ORDER BY item_id LIMIT 64 OFFSET ?",
          job,
          start,
        );
        const items = rows.map((row) => {
          const item = JSON.parse(row.payload);
          for (const key of ["artwork", "artistArtwork"]) {
            if (item.metadata[key])
              item.metadata[key] =
                `sovel-art:${JSON.stringify([source.id, item.metadata[key]])}`;
          }
          return item;
        });
        await transaction.runAsync(
          `INSERT INTO tracks(id,source_id,uri,path,size,mtime,metadata,available) VALUES ${items.map(() => "(?,?,?,?,?,?,?,1)").join(",")} ON CONFLICT(source_id,path) DO UPDATE SET uri=excluded.uri,size=excluded.size,mtime=excluded.mtime,metadata=excluded.metadata,available=1`,
          ...items.flatMap((item) => [
            `${source.id}:${item.id}`,
            source.id,
            client.stream(source.config!, item.id, item.metadata.mediaSourceId),
            item.id,
            item.size,
            item.mtime,
            JSON.stringify({ ...item.metadata, remotePath: item.path }),
          ]),
        );
        await new Catalog(transaction).index(
          items.map((item) => ({
            id: `${source.id}:${item.id}`,
            source_id: source.id,
            path: item.id,
            metadata: JSON.stringify({
              ...item.metadata,
              remotePath: item.path,
            }),
          })),
        );
        progress({
          sourceId: source.id,
          phase: "importing",
          done: Math.min(start + 64, offset),
          total,
        });
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      check();
      await transaction.runAsync(
        "UPDATE tracks SET available=0 WHERE source_id=? AND path NOT IN (SELECT item_id FROM remote_stage WHERE job=?)",
        source.id,
        job,
      );
      await new Catalog(transaction).configureSource(source.id, {
        syncedAt: Date.now(),
      });
    });
    return offset;
  } finally {
    await db.runAsync("DELETE FROM remote_stage WHERE job=?", job);
  }
}
