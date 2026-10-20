import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultUpdatePreferences,
  normalizeUpdatePreferences,
  releaseVersion,
  findUpdate,
  parseUpdatePackage,
  releaseAssetUrl,
} from "../src/core/appUpdates";
const repo = "quguai/sovel-player";
const githubRelease = (tag = "v0.2.0", extra = {}) => ({
  tag_name: tag,
  body: "Fix playback",
  assets: [
    {
      name: "update.json",
      browser_download_url: releaseAssetUrl(repo, tag, "update.json"),
    },
  ],
  ...extra,
});
const find = (
  data: unknown,
  channel: "stable" | "preview" = "stable",
  code = 1,
) => findUpdate(data, channel, code, repo);
test("tag ordering keeps beta < rc < stable, then the next patch/minor/major", () => {
  const tags = [
    "v0.1.0-beta.1",
    "v0.1.0-beta.99",
    "v0.1.0-rc.1",
    "v0.1.0-rc.99",
    "v0.1.0",
    "v0.1.1-beta.1",
    "v0.2.0-beta.1",
    "v1.0.0-beta.1",
  ];
  const codes = tags.map((t) => releaseVersion(t)!.code);
  assert.deepEqual(
    [...codes].sort((a, b) => a - b),
    codes,
  );
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(releaseVersion("v99.99.99")!.code, 999999999);
  for (const tag of [
    "v1",
    "v01.2.3",
    "v100.0.0",
    "v1.100.0",
    "v1.0.0-beta.0",
    "v1.0.0-beta.100",
    "v1.0.0-foo.1",
    "v1.0.0+build.1",
    "v1.2.3\n",
  ])
    assert.equal(releaseVersion(tag), null);
});
test("stable filters previews, drafts, missing assets, malformed tags and downgrades", () => {
  const releases = [
    githubRelease("v0.4.0-beta.1", { prerelease: true }),
    githubRelease("v0.3.0", { draft: true }),
    githubRelease("v0.5.0", { assets: [] }),
    githubRelease("v0.2.0"),
    githubRelease("v0.1.0"),
    githubRelease("vgarbage"),
  ];
  assert.equal(find(releases)?.tag, "v0.2.0");
  assert.equal(find(releases, "preview")?.tag, "v0.4.0-beta.1");
  assert.equal(find(releases, "stable", releaseVersion("v0.2.0")!.code), null);
  assert.equal(
    find([githubRelease("v0.4.0-rc.1", { prerelease: false })]),
    null,
  );
  assert.equal(find([githubRelease("v0.4.0", { prerelease: true })]), null);
  assert.equal(find([null, {}, githubRelease("0.2.0")]), null);
  assert.throws(() => find({ message: "rate limit" }));
});
test("release lookup uses the highest version rather than GitHub publication order", () => {
  assert.equal(
    find([
      githubRelease("v1.0.0"),
      githubRelease("v1.10.0"),
      githubRelease("v1.2.0"),
    ])?.version,
    "1.10.0",
  );
});
test("manifest binds checksum, bytes, APK, package, native versionCode and exact repository/tag", () => {
  const release = find([githubRelease()])!;
  const manifest = {
    schema: 1,
    version: release.version,
    versionCode: release.code,
    packageId: "cn.quguai.music.sovel",
    name: "sovel-0.2.0-universal.apk",
    sha256: "a".repeat(64),
    size: 1000,
    url: releaseAssetUrl(repo, release.tag, "sovel-0.2.0-universal.apk"),
  };
  const parse = (p: unknown) =>
    parseUpdatePackage(p, release, repo, manifest.packageId);
  assert.equal(parse(manifest).sha256, manifest.sha256);
  for (const patch of [
    { schema: 2 },
    { version: "0.1.0" },
    { versionCode: 1 },
    { packageId: "other.app" },
    { size: 0 },
    { size: 1.5 },
    { size: 2 ** 31 },
    { sha256: "a" },
    { name: "../update.apk" },
    { url: "http://github.com/file.apk" },
    { url: releaseAssetUrl("evil/fork", release.tag, manifest.name) },
    { url: releaseAssetUrl(repo, "v0.1.0", manifest.name) },
  ])
    assert.throws(() => parse({ ...manifest, ...patch }));
  assert.throws(() => parse(null));
  assert.equal(
    find([
      githubRelease("v0.2.0", {
        assets: [
          {
            name: "update.json",
            browser_download_url: "https://evil.example/update.json",
          },
        ],
      }),
    ]),
    null,
  );
});
test("update preferences default to check-only and sanitize persisted values", () => {
  assert.deepEqual(normalizeUpdatePreferences(null), defaultUpdatePreferences);
  assert.deepEqual(
    normalizeUpdatePreferences({
      autoCheck: false,
      wifiDownload: true,
      channel: "preview",
      ignoredTag: "v1.0.0",
      checkedAt: 123,
    }),
    {
      autoCheck: false,
      wifiDownload: true,
      channel: "preview",
      ignoredTag: "v1.0.0",
      checkedAt: 123,
    },
  );
  assert.equal(
    normalizeUpdatePreferences({
      wifiDownload: "true",
      channel: "anything",
      checkedAt: NaN,
    }).wifiDownload,
    false,
  );
});
