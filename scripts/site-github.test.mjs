import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRelease, releaseView, loadGitHub } from '../site/github.js';
import { labels } from '../site/copy.js';

test.beforeEach(() => { try { sessionStorage.clear(); } catch { /* Node without web storage. */ } });

const apk = (name = 'sovel-universal.apk', url = `https://github.com/quguai/sovel-player/releases/download/v0.1.0/${name}`) => ({ name, state: 'uploaded', size: 10485760, browser_download_url: url });
const release = (changes = {}) => ({ tag_name: 'v0.1.0', published_at: '2026-10-20T00:00:00Z', html_url: 'https://github.com/quguai/sovel-player/releases/tag/v0.1.0', draft: false, prerelease: false, assets: [apk()], ...changes });

test('downloads the published universal APK and renders its actual version and size', () => {
  const normalized = normalizeRelease(release({ assets: [apk('sovel-arm64.apk'), apk()] }));
  const view = releaseView({ release: normalized }, labels.en, 'en');
  assert.equal(view.href, apk().browser_download_url);
  assert.equal(view.title, 'Sovel HiFi v0.1.0');
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
    assert.equal(paths.length, 3);
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
    assert.equal(releaseView(state, labels.en, 'en').href, 'https://github.com/quguai/sovel-player/releases');
  } finally { globalThis.fetch = original; }
});
