export const repositoryUrl = 'https://github.com/quguai/sovel-player';
const api = 'https://api.github.com/repos/quguai/sovel-player';
const history = `${repositoryUrl}/releases`;

function safeReleaseUrl(value, asset = false) {
  try {
    const url = new URL(value);
    const prefix = asset ? '/quguai/sovel-player/releases/download/' : '/quguai/sovel-player/releases/tag/';
    return url.origin === 'https://github.com' && !url.username && !url.password && url.pathname.startsWith(prefix) ? url.href : null;
  } catch { return null; }
}

export function normalizeRelease(value) {
  if (!value || value.draft || typeof value.tag_name !== 'string' || !value.tag_name.trim() || !Number.isFinite(Date.parse(value.published_at))) return null;
  const url = safeReleaseUrl(value.html_url);
  if (!url) return null;
  const assets = (Array.isArray(value.assets) ? value.assets : []).filter(asset =>
    typeof asset?.name === 'string' && /\.apk$/i.test(asset.name) && asset.state === 'uploaded' &&
    Number.isSafeInteger(asset.size) && asset.size > 0 && safeReleaseUrl(asset.browser_download_url, true),
  );
  // Do not guess an ABI when a release contains several architecture-specific packages.
  const asset = assets.find(item => /universal/i.test(item.name)) ?? (assets.length === 1 ? assets[0] : null);
  return {
    tag: value.tag_name.slice(0, 100), url, preview: value.prerelease === true,
    date: value.published_at,
    asset: asset ? { name: asset.name, size: asset.size, url: safeReleaseUrl(asset.browser_download_url, true) } : null,
  };
}

async function request(path, allowMissing = false) {
  const key = `sovel-github:${path}`;
  try {
    const cached = JSON.parse(sessionStorage.getItem(key));
    const age = Date.now() - cached?.time;
    if (age >= 0 && age < 300_000) return cached.data;
  } catch { /* Storage is optional. */ }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${api}${path}`, {
      signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok && !(allowMissing && response.status === 404)) throw new Error(`GitHub HTTP ${response.status}`);
    const data = response.status === 404 ? null : await response.json();
    try { sessionStorage.setItem(key, JSON.stringify({ time: Date.now(), data })); } catch { /* Storage is optional. */ }
    return data;
  } finally { clearTimeout(timer); }
}

export async function loadGitHub(update) {
  await Promise.allSettled([
    (async () => {
      try {
        const data = await request('');
        if (!Number.isSafeInteger(data?.stargazers_count) || data.stargazers_count < 0) throw new Error('Invalid star count');
        update({ stars: data.stargazers_count });
      } catch { update({ stars: null }); }
    })(),
    (async () => {
      try {
        const latest = await request('/releases/latest', true);
        let release;
        if (latest !== null) {
          release = normalizeRelease(latest);
          if (!release) throw new Error('Invalid release');
        } else {
          const list = await request('/releases?per_page=20');
          if (!Array.isArray(list)) throw new Error('Invalid release list');
          release = list.map(normalizeRelease).filter(Boolean).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0] ?? null;
          if (list.length && !release) throw new Error('No valid published release');
        }
        update({ release, error: false });
      } catch { update({ error: true }); }
    })(),
  ]);
}

export function releaseView(state, copy, language) {
  if (state.error) return { title: copy.releaseError, description: copy.releaseErrorBody, channel: 'GITHUB', href: history, button: copy.viewReleases };
  if (state.release === undefined) return null;
  if (state.release === null) return { title: copy.noRelease, description: copy.noReleaseBody, channel: copy.comingSoon, href: history, button: copy.viewReleases };
  const release = state.release;
  const info = [new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(release.date))];
  if (release.asset) info.push(`${(release.asset.size / 1024 / 1024).toFixed(1)} MB`, release.asset.name);
  else info.push(copy.noPackage);
  return {
    title: `Sovel HiFi ${release.tag.replace(/^v(?=\d)/, '')}`, description: info.join(' · '),
    channel: release.preview ? copy.beta : copy.stable, asset: release.asset,
    href: release.asset?.url ?? release.url, notes: release.url,
    button: release.asset ? copy.download : copy.viewReleases,
  };
}
