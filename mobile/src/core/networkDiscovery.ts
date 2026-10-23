import type { RemoteKind } from "./types";
export type DiscoveryReply = { kind: string; address: string; data: string };
export type DiscoveredServer = {
  id: string;
  kind: RemoteKind;
  name: string;
  url: string;
};
export function parseDiscovery(reply: DiscoveryReply): DiscoveredServer | null {
  try {
    if (reply.data.length > 65536) return null;
    if (reply.kind === "jellyfin" || reply.kind === "emby") {
      const value = JSON.parse(reply.data);
      const url = safeAddress(value.Address || value.LocalAddress);
      if (!url) return null;
      return {
        id: `${reply.kind}:${value.Id || url}`,
        kind: reply.kind,
        name: String(
          value.Name || (reply.kind === "emby" ? "Emby" : "Jellyfin"),
        ).slice(0, 160),
        url,
      };
    }
    if (reply.kind === "dlna") {
      const lines = new Map(
        reply.data
          .split(/\r?\n/)
          .slice(1)
          .map((line) => {
            const colon = line.indexOf(":");
            return [
              line.slice(0, colon).trim().toLowerCase(),
              line.slice(colon + 1).trim(),
            ];
          }),
      );
      const url = safeAddress(lines.get("location"));
      if (!url || !/^HTTP\/1\.[01] 200/.test(reply.data)) return null;
      return {
        id: `dlna:${lines.get("usn") || url}`,
        kind: "dlna",
        name: "DLNA 音乐服务器",
        url,
      };
    }
    return null;
  } catch {
    return null;
  }
}
export function safeAddress(value: unknown) {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.hash
      ? url.toString().replace(/\/$/, "")
      : null;
  } catch {
    return null;
  }
}
export function mergeDiscovery(replies: DiscoveryReply[]) {
  const found = new Map<string, DiscoveredServer>();
  for (const reply of replies) {
    const server = parseDiscovery(reply);
    if (server) found.set(server.id, server);
  }
  return [...found.values()].sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
  );
}
