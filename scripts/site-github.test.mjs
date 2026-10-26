import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRelease, releaseView, loadGitHub, bindReleaseDownloads } from '../site/github.js';
import { labels } from '../site/copy.js';

test.beforeEach(() => { try { sessionStorage.clear(); } catch { /* Node without web storage. */ } });

const apk = (name = 'sovel-universal.apk', url = `https://github.com/quguai/sovel-player/releases/download/v0.1.0/${name}`) => ({ name, state: 'uploaded', size: 10485760, download_count: 0, browser_download_url: url });
const release = (changes = {}) => ({ tag_name: 'v0.1.0', published_at: '2026-10-20T00:00:00Z', html_url: 'https://github.com/quguai/sovel-player/releases/tag/v0.1.0', draft: false, prerelease: false, assets: [apk()], ...changes });

test('downloads the published universal APK and renders its actual version and size', () => {
  const normalized = normalizeRelease(release({ assets: [apk('sovel-arm64.apk'), apk()] }));
  const view = releaseView({ release: normalized }, labels.en, 'en');
  assert.equal(view.href, apk().browser_download_url);
  assert.equal(view.title, 'Sovel HiFi 0.1.0');
  assert.match(view.description, /10\.0 MB/);
  assert.equal(view.channel, 'STABLE');
});

test('does not guess an architecture or download untrusted/non-APK URLs', () => {
  for (const assets of [[apk('arm.apk'), apk('x86.apk')], [apk('update.json')], [apk('sovel.apk', 'https://example.com/file.apk')], [apk('sovel.apk', 'javascript:alert(1)')], [{ ...apk(), state: 'open' }]]) {
    const value = normalizeRelease(release({ assets }));
    assert.equal(value.asset, null);
    assert.equal(releaseView({ release: value }, labels.en, 'en').href, value.url);
  }
  assert.equal(normalizeRelease(release({ draft: true })), null);
  assert.equal(normalizeRelease(release({ html_url: 'https://example.com/release' })), null);
});

test('preview, empty, and failed requests have honest localized fallbacks', () => {
  assert.equal(releaseView({ release: normalizeRelease(release({ prerelease: true })) }, labels.zh, 'zh').channel, '预览版');
  assert.equal(releaseView({ release: null }, labels.zh, 'zh').title, labels.zh.noRelease);
  assert.equal(releaseView({ error: true }, labels.en, 'en').button, labels.en.viewReleases);
  assert.equal(releaseView({ release: undefined }, labels.en, 'en'), null);
});

test('loads stars independently and falls back to preview releases when no stable release exists', async () => {
  const original = globalThis.fetch;
  const paths = [];
  globalThis.fetch = async url => {
    paths.push(url);
    if (url.endsWith('/latest')) return new Response(null, { status: 404 });
    if (url.includes('?per_page=')) return Response.json([release({ prerelease: true })]);
    return Response.json({ stargazers_count: 0 });
  };
  try {
    const state = {};
    await loadGitHub(update => Object.assign(state, update));
    assert.equal(state.stars, 0);
    assert.equal(state.release.preview, true);
    assert.equal(state.downloads, 0);
    assert.equal(paths.length, 4);
  } finally { globalThis.fetch = original; }
});

test('rate limiting preserves working stars and provides a Releases fallback', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => url.endsWith('sovel-player') ? Response.json({ stargazers_count: 17 }) : new Response(null, { status: 403 });
  try {
    const state = {};
    await loadGitHub(update => Object.assign(state, update));
    assert.equal(state.stars, 17);
    assert.equal(state.error, true);
    assert.equal(state.downloads, null);
    assert.equal(releaseView(state, labels.en, 'en').href, 'https://github.com/quguai/sovel-player/releases');
  } finally { globalThis.fetch = original; }
});

test('cumulative downloads span every release page and architecture but exclude drafts and metadata', async () => {
  const original = globalThis.fetch;
  const paths = [];
  const firstPage = [
    release({ assets: [{ ...apk('arm64.apk'), download_count: 7 }, apk('arm32.apk'), { ...apk('update.json'), download_count: 999 }] }),
    release({ draft: true, assets: [{ ...apk(), download_count: 100 }] }),
    ...Array.from({ length: 98 }, () => release({ assets: [] })),
  ];
  globalThis.fetch = async url => {
    paths.push(url);
    if (url.endsWith('page=1')) return Response.json(firstPage);
    if (url.endsWith('page=2')) return Response.json([release({ prerelease: true, assets: [
      { ...apk('legacy.APK'), download_count: 4 }, { ...apk(), state: 'open', download_count: 100 },
    ] })]);
    return Response.json(url.endsWith('/latest') ? release() : { stargazers_count: 17 });
  };
  try {
    const state = {};
    await loadGitHub(update => Object.assign(state, update));
    assert.equal(state.downloads, 11);
    assert.equal(state.stars, 17);
    assert.equal(state.error, false);
    assert.equal(paths.filter(url => url.includes('per_page=100')).length, 2);
  } finally { globalThis.fetch = original; }
});

test('an empty published history displays a genuine zero', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => url.includes('per_page=100') ? Response.json([])
    : Response.json(url.endsWith('/latest') ? release() : { stargazers_count: 0 });
  try {
    const state = {};
    await loadGitHub(update => Object.assign(state, update));
    assert.equal(state.downloads, 0);
    assert.equal(state.error, false);
  } finally { globalThis.fetch = original; }
});

test('a failed later page never publishes a partial count or disables a working APK link', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    if (url.endsWith('page=1')) return Response.json(Array.from({ length: 100 }, () => release({ assets: [{ ...apk(), download_count: 1 }] })));
    if (url.endsWith('page=2')) return new Response(null, { status: 403 });
    return Response.json(url.endsWith('/latest') ? release() : { stargazers_count: 17 });
  };
  try {
    const updates = [];
    const state = {};
    await loadGitHub(update => { updates.push(update); Object.assign(state, update); });
    assert.deepEqual(updates.filter(update => 'downloads' in update), [{ downloads: null }]);
    assert.equal(releaseView(state, labels.en, 'en').href, apk().browser_download_url);
    assert.equal(state.stars, 17);
  } finally { globalThis.fetch = original; }
});

test('invalid counters or release lists remain unavailable instead of becoming zero', async () => {
  const original = globalThis.fetch;
  try {
    for (const data of [null, {}, ...[-1, '12', null, 0.5].map(download_count => [release({ assets: [{ ...apk(), download_count }] })])]) {
      globalThis.fetch = async url => url.includes('per_page=100') ? Response.json(data)
        : Response.json(url.endsWith('/latest') ? release() : { stargazers_count: 17 });
      const state = {};
      await loadGitHub(update => Object.assign(state, update));
      assert.equal(state.downloads, null);
      assert.equal(state.error, false);
    }
  } finally { globalThis.fetch = original; }
});

function downloadLink() {
  const link = new EventTarget();
  const attributes = new Map([['target', '_blank']]);
  const label = { textContent: 'Get Sovel' };
  link.setAttribute = (key, value) => attributes.set(key, value);
  link.removeAttribute = key => attributes.delete(key);
  link.querySelector = selector => selector === 'span' ? label : null;
  link.navigations = [];
  link.click = () => {
    if (link.dispatchEvent(new Event('click', { cancelable: true }))) link.navigations.push(link.href);
  };
  return Object.assign(link, { attributes, label });
}

test('every download entry uses the APK directly without opening another tab', () => {
  const links = Array.from({ length: 3 }, downloadLink);
  const update = bindReleaseDownloads(links);
  update(releaseView({ release: normalizeRelease(release()) }, labels.en, 'en'), labels.en);
  for (const link of links) {
    link.click();
    assert.deepEqual(link.navigations, [apk().browser_download_url]);
    assert.equal(link.attributes.has('target'), false);
    assert.equal(link.attributes.get('download'), apk().name);
    assert.equal(link.label.textContent, labels.en.download);
  }
});

test('an early click waits for release metadata and triggers only one APK download', () => {
  const link = downloadLink();
  const update = bindReleaseDownloads([link]);
  update(null, labels.zh);
  link.click();
  link.click();
  assert.deepEqual(link.navigations, []);
  assert.equal(link.label.textContent, labels.zh.checkingRelease);
  assert.equal(link.attributes.get('aria-busy'), 'true');
  const view = releaseView({ release: normalizeRelease(release({ prerelease: true })) }, labels.zh, 'zh');
  update(view, labels.zh);
  update(view, labels.en);
  assert.deepEqual(link.navigations, [apk().browser_download_url]);
  assert.equal(link.attributes.get('aria-busy'), 'false');
});

test('unavailable downloads show an explicit Releases fallback instead of an APK label', () => {
  const link = downloadLink();
  const update = bindReleaseDownloads([link]);
  update(releaseView({ error: true }, labels.zh, 'zh'), labels.zh);
  assert.equal(link.label.textContent, labels.zh.viewReleases);
  assert.equal(link.attributes.has('download'), false);
  assert.equal(link.href, 'https://github.com/quguai/sovel-player/releases');
});

test('package selection updates every direct download and the displayed filename and size', () => {
  const arm = { ...apk('sovel-0.1.0-arm64-v8a.apk'), size: 30 * 1024 * 1024 };
  const intel = apk('sovel-0.1.0-x86_64.apk');
  const state = { release: normalizeRelease(release({ assets: [apk(), arm, intel] })) };
  const links = Array.from({ length: 3 }, downloadLink);
  const update = bindReleaseDownloads(links);
  const view = releaseView(state, labels.zh, 'zh', 'arm64-v8a');
  assert.equal(view.asset.abi, 'arm64-v8a');
  assert.match(view.description, /30\.0 MB/);
  assert.ok(view.description.includes(arm.name));
  update(view, labels.zh);
  for (const link of links) {
    link.click();
    assert.deepEqual(link.navigations, [arm.browser_download_url]);
    assert.equal(link.attributes.get('download'), arm.name);
  }
  update(releaseView(state, labels.en, 'en', 'x86_64'), labels.en);
  for (const link of links) {
    assert.equal(link.href, intel.browser_download_url);
    assert.equal(link.label.textContent, labels.en.download);
  }
});

test('universal-only and missing saved packages fall back without guessing unpublished URLs', () => {
  const state = { release: normalizeRelease(release()) };
  const view = releaseView(state, labels.zh, 'zh', 'arm64-v8a');
  assert.equal(view.href, apk().browser_download_url);
  assert.equal(view.packageHint, labels.zh.universalOnly);
  const available = normalizeRelease(release({ assets: [apk(), apk('sovel-0.1.0-armeabi-v7a.apk')] }));
  assert.equal(releaseView({ release: available }, labels.en, 'en', 'arm64-v8a').packageHint, labels.en.packageFallback);
  assert.equal(releaseView({ release: available }, labels.en, 'en', 'arm64-v8a').asset.abi, 'universal');
});

test('architecture-only releases require a user choice and ambiguous ABI assets are not guessed', () => {
  const arm = apk('sovel-0.1.0-arm64-v8a.apk');
  const state = { release: normalizeRelease(release({ assets: [arm] })) };
  assert.equal(releaseView(state, labels.en, 'en').asset, null);
  assert.ok(releaseView(state, labels.en, 'en').description.includes(labels.en.choosePackage));
  assert.equal(releaseView(state, labels.en, 'en', 'arm64-v8a').href, arm.browser_download_url);
  const ambiguous = normalizeRelease(release({ assets: [arm, apk('other-arm64-v8a.apk')] }));
  assert.equal(ambiguous.packages.length, 0);
  assert.equal(releaseView({ release: ambiguous }, labels.en, 'en', 'arm64-v8a').asset, null);
});

test('download options reject assets from another version or with mismatched filenames', () => {
  for (const value of [
    apk('sovel-arm64-v8a.apk', 'https://github.com/quguai/sovel-player/releases/download/v0.0.1/sovel-arm64-v8a.apk'),
    apk('sovel-arm64-v8a.apk', 'https://github.com/quguai/sovel-player/releases/download/v0.1.0/other.apk'),
  ]) {
    const normalized = normalizeRelease(release({ assets: [value] }));
    assert.equal(normalized.packages.length, 0);
    assert.equal(normalized.asset, null);
  }
});
