// Only edits the generated sample track in the booted iOS simulator.
// Run before testWrappedLyricsAndBrowsingFocus; run again with --restore afterwards.
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const backup = resolve(
  import.meta.dirname,
  "../artifacts/lyrics-wrap-fixture-backup.json",
);
const container = execFileSync(
  "xcrun",
  ["simctl", "get_app_container", "booted", "cn.quguai.music.sovel", "data"],
  { encoding: "utf8" },
).trim();
const db = new DatabaseSync(resolve(container, "Documents/SQLite/sovel.db"));
try {
  if (process.argv.includes("--restore")) {
    const saved = JSON.parse(readFileSync(backup, "utf8"));
    db.prepare("UPDATE tracks SET metadata=? WHERE id=?").run(
      saved.metadata,
      saved.id,
    );
    unlinkSync(backup);
  } else {
    if (existsSync(backup))
      throw new Error("Restore the existing fixture backup first");
    const id = "local:Sovel - 初见.wav";
    const row = db.prepare("SELECT metadata FROM tracks WHERE id=?").get(id);
    if (!row) throw new Error("Import the generated Sovel sample audio first");
    writeFileSync(backup, JSON.stringify({ id, metadata: row.metadata }));
    const metadata = JSON.parse(row.metadata);
    metadata.lyrics[1].text =
      "光落在安静的房间，听一首很长很长的歌，让每一个字都留在眼前。";
    db.prepare("UPDATE tracks SET metadata=? WHERE id=?").run(
      JSON.stringify(metadata),
      id,
    );
  }
} finally {
  db.close();
}
