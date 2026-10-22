export type UpdateChannel = "stable" | "preview";
export type UpdatePreferences = {
  autoCheck: boolean;
  wifiDownload: boolean;
  channel: UpdateChannel;
  ignoredTag: string;
  checkedAt: number;
};
export const defaultUpdatePreferences: UpdatePreferences = {
  autoCheck: true,
  wifiDownload: false,
  channel: "stable",
  ignoredTag: "",
  checkedAt: 0,
};
export function normalizeUpdatePreferences(value: unknown): UpdatePreferences {
  const p = (
    value && typeof value === "object" ? value : {}
  ) as Partial<UpdatePreferences>;
  return {
    autoCheck: p.autoCheck !== false,
    wifiDownload: p.wifiDownload === true,
    channel: p.channel === "preview" ? "preview" : "stable",
    ignoredTag: typeof p.ignoredTag === "string" ? p.ignoredTag : "",
    checkedAt:
      typeof p.checkedAt === "number" && Number.isFinite(p.checkedAt)
        ? p.checkedAt
        : 0,
  };
}
// Deliberately bounded so versionCode stays below Android's 2,100,000,000 limit.
export function releaseVersion(tag: string) {
  const m =
    /^v?(0|[1-9]\d?)\.(0|[1-9]\d?)\.(0|[1-9]\d?)(?:-(beta|rc)\.([1-9]\d?))?$/.exec(
      tag,
    );
  if (!m) return null;
  const stage =
    m[4] === "beta" ? Number(m[5]) : m[4] === "rc" ? 100 + Number(m[5]) : 999;
  return {
    version: tag.replace(/^v/, ""),
    preview: !!m[4],
    code:
      (Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3])) * 1000 + stage,
  };
}
export type Release = {
  tag: string;
  version: string;
  code: number;
  notes: string;
  url: string;
  manifestUrl: string;
  publishedAt: string;
  preview: boolean;
};
export function repositoryName(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)
  )
    throw new Error("更新仓库配置无效");
  return value;
}
export function releaseAssetUrl(repo: string, tag: string, name: string) {
  repositoryName(repo);
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;
}
export function findUpdate(
  data: unknown,
  channel: UpdateChannel,
  installedCode: number,
  repo: string,
): Release | null {
  if (!Array.isArray(data)) throw new Error("版本服务返回了无效数据");
  return (
    data
      .flatMap((r) => {
        const v =
          typeof r?.tag_name === "string" && r.tag_name.startsWith("v")
            ? releaseVersion(r.tag_name)
            : null;
        if (
          !v ||
          r.draft ||
          (channel === "stable" && (r.prerelease || v.preview)) ||
          v.code <= installedCode
        )
          return [];
        const url = releaseAssetUrl(repo, r.tag_name, "update.json");
        if (
          !Array.isArray(r.assets) ||
          !r.assets.some(
            (a: any) =>
              a.name === "update.json" && a.browser_download_url === url,
          )
        )
          return [];
        return [
          {
            tag: r.tag_name,
            version: v.version,
            code: v.code,
            preview: v.preview || !!r.prerelease,
            notes: typeof r.body === "string" ? r.body.slice(0, 16000) : "",
            publishedAt:
              typeof r.published_at === "string" ? r.published_at : "",
            url: `https://github.com/${repositoryName(repo)}/releases/tag/${encodeURIComponent(r.tag_name)}`,
            manifestUrl: url,
          },
        ];
      })
      .sort((a, b) => b.code - a.code)[0] || null
  );
}
export const androidPackageAbis = [
  "arm64-v8a",
  "armeabi-v7a",
  "x86_64",
] as const;
export type UpdatePackage = {
  version: string;
  versionCode: number;
  packageId: string;
  name: string;
  size: number;
  sha256: string;
  url: string;
  abi?: (typeof androidPackageAbis)[number] | "universal";
};
export function parseUpdatePackage(
  input: unknown,
  release: Release,
  repo: string,
  packageId: string,
  supportedAbis: readonly string[] = [],
): UpdatePackage {
  const manifest = input as Partial<UpdatePackage> & {
    schema?: number;
    packages?: unknown;
  };
  if (!manifest || manifest.schema !== 1)
    throw new Error("更新信息格式不受支持");
  const validate = (value: unknown, abi: string): UpdatePackage => {
    const p = value as Partial<UpdatePackage>;
    if (
      !p ||
      p.version !== release.version ||
      p.versionCode !== release.code ||
      p.packageId !== packageId ||
      p.name !== `sovel-${release.version}-${abi}.apk` ||
      !Number.isSafeInteger(p.size) ||
      p.size! <= 0 ||
      p.size! > 1024 * 1024 * 1024 ||
      typeof p.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(p.sha256) ||
      p.url !== releaseAssetUrl(repo, release.tag, p.name)
    )
      throw new Error("安装包信息不完整或与此版本不匹配");
    return p as UpdatePackage;
  };
  // Keep schema 1's top-level universal entry for already-distributed clients.
  const universal = validate(manifest, "universal");
  if (manifest.packages === undefined) return universal;
  if (!Array.isArray(manifest.packages) || manifest.packages.length > 4)
    throw new Error("更新安装包列表无效");
  for (const abi of supportedAbis) {
    if (!androidPackageAbis.some((supported) => supported === abi)) continue;
    const matches = manifest.packages.filter((entry) => entry?.abi === abi);
    if (matches.length > 1) throw new Error("更新安装包架构重复");
    if (matches.length === 1) return validate(matches[0], abi);
  }
  return universal;
}
