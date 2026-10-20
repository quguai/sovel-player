import { isAudio, type Entry, type ScanRules } from "./types";
import { excludesPath } from "./scanRules";

export type DirectoryChild = {
  name: string;
  uri: string;
  directory: boolean;
  size: number;
  mtime: number;
};

// All workers share one work queue: branching trees cannot multiply concurrency.
export async function discoverDirectory(
  root: string,
  read: (uri: string) => Promise<DirectoryChild[]>,
  signal?: AbortSignal,
  rules?: ScanRules,
  progress?: (count: number, path: string) => void,
): Promise<Entry[]> {
  const queue = [{ uri: root, prefix: "" }];
  const visited = new Set([root]);
  const entries: Entry[] = [];
  const pending = new Set<Promise<void>>();
  let cursor = 0;
  let failure: unknown;
  let failed = false;
  const check = () => {
    if (signal?.aborted) throw new Error("扫描已取消");
  };
  const walk = async (uri: string, prefix: string) => {
    check();
    const children = await read(uri);
    check();
    const lyrics = new Map(
      children
        .filter((c) => !c.directory && /\.lrc$/i.test(c.name))
        .map((c) => [c.name.toLowerCase(), c.uri]),
    );
    for (let index = 0; index < children.length; index++) {
      check();
      if (failed) return;
      const child = children[index],
        path = prefix + child.name;
      if (child.directory) {
        if (
          (!rules || (rules.includeSubfolders && !excludesPath(path, rules))) &&
          !visited.has(child.uri)
        ) {
          visited.add(child.uri);
          queue.push({ uri: child.uri, prefix: `${path}/` });
        }
      } else if (isAudio(child.name)) {
        // Keep filtered files in the discovery snapshot so they aren't marked missing.
        entries.push({
          path,
          uri: child.uri,
          size: child.size,
          mtime: child.mtime,
          lyricUri: lyrics.get(
            child.name.replace(/\.[^.]+$/, ".lrc").toLowerCase(),
          ),
        });
      }
      if (index % 128 === 127) {
        progress?.(entries.length, path);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    progress?.(entries.length, prefix);
  };
  try {
    while (cursor < queue.length || pending.size) {
      check();
      if (failed) throw failure;
      while (cursor < queue.length && pending.size < 4) {
        const item = queue[cursor++];
        const task = walk(item.uri, item.prefix)
          .catch((error) => {
            if (!failed) {
              failed = true;
              failure = error;
            }
          })
          .finally(() => pending.delete(task));
        pending.add(task);
      }
      await Promise.race(pending);
    }
    check();
    if (failed) throw failure;
  } finally {
    // Do not release the scan lock while native reads from this job are still running.
    await Promise.allSettled(pending);
  }
  progress?.(entries.length, "");
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}
