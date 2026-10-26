export const repositoryUrl = 'https://github.com/quguai/sovel-player';
const api = 'https://api.github.com/repos/quguai/sovel-player';
const history = `${repositoryUrl}/releases`;
export const packageAbis = ['universal', 'arm64-v8a', 'armeabi-v7a', 'x86_64'];

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
  const assetBase = `/quguai/sovel-player/releases/download/${encodeURIComponent(value.tag_name)}/`;
  const assets = (Array.isArray(value.assets) ? value.assets : []).filter(asset =>
    typeof asset?.name === 'string' && /\.apk$/i.test(asset.name) && asset.state === 'uploaded' &&
    Number.isSafeInteger(asset.size) && asset.size > 0 && safeReleaseUrl(asset.browser_download_url, true) &&
    new URL(asset.browser_download_url).pathname === `${assetBase}${encodeURIComponent(asset.name)}`,
  ).map(asset => ({
    name: asset.name, size: asset.size, url: safeReleaseUrl(asset.browser_download_url, true),
    abi: /-(universal|arm64-v8a|armeabi-v7a|x86_64)\.apk$/i.exec(asset.name)?.[1].toLowerCase() ?? null,
  }));
  const packages = assets.filter(asset => asset.abi && assets.filter(other => other.abi === asset.abi).length === 1);
  // Do not guess an ABI when a release contains several architecture-specific packages.
  const asset = packages.find(item => item.abi === 'universal') ?? (assets.length === 1 && !assets[0].abi ? assets[0] : null);
  return {
    tag: value.tag_name.slice(0, 100), url, preview: value.prerelease === true,
    date: value.published_at,
    asset, packages,
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

async function totalApkDownloads() {
  let total = 0;
  for (let page = 1; ; page++) {
    const releases = await request(`/releases?per_page=100&page=${page}`);
    if (!Array.isArray(releases)) throw new Error('Invalid release list');
    for (const release of releases) {
      if (release?.draft) continue;
      if (!release?.published_at || !Array.isArray(release.assets)) throw new Error('Invalid published release');
      for (const asset of release.assets) {
        if (asset?.state !== 'uploaded' || typeof asset.name !== 'string' || !/\.apk$/i.test(asset.name)) continue;
        if (!Number.isSafeInteger(asset.download_count) || asset.download_count < 0) throw new Error('Invalid download count');
        total += asset.download_count;
        if (!Number.isSafeInteger(total)) throw new Error('Invalid download total');
      }
    }
    if (releases.length < 100) return total;
  }
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
      try { update({ downloads: await totalApkDownloads() }); }
      catch { update({ downloads: null }); }
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

export function releaseView(state, copy, language, preferredAbi = 'universal') {
  if (state.error) return { title: copy.releaseError, description: copy.releaseErrorBody, channel: 'GITHUB', href: history, button: copy.viewReleases };
  if (state.release === undefined) return null;
  if (state.release === null) return { title: copy.noRelease, description: copy.noReleaseBody, channel: copy.comingSoon, href: history, button: copy.viewReleases };
  const release = state.release;
  const packages = release.packages ?? [];
  const asset = packages.find(item => item.abi === preferredAbi) ?? release.asset;
  const info = [new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(release.date))];
  if (asset) info.push(`${(asset.size / 1024 / 1024).toFixed(1)} MB`, asset.name);
  else info.push(packages.length ? copy.choosePackage : copy.noPackage);
  return {
    title: `Sovel HiFi ${release.tag.replace(/^v(?=\d)/, '')}`, description: info.join(' · '),
    channel: release.preview ? copy.beta : copy.stable, asset, packages,
    href: asset?.url ?? release.url, notes: release.url,
    button: asset ? copy.download : copy.viewReleases,
    packageHint: packages.length === 1 && packages[0].abi === 'universal' ? copy.universalOnly
      : preferredAbi !== 'universal' && asset?.abi !== preferredAbi ? copy.packageFallback : copy.packageHelp,
  };
}

// A click before the release request finishes waits for the actual asset URL.
export function bindReleaseDownloads(links) {
  let ready = false;
  let pending = null;
  for (const link of links) {
    link.addEventListener('click', event => {
      if (ready || event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      pending = link;
    });
  }
  return (view, copy) => {
    ready = Boolean(view);
    for (const link of links) {
      link.setAttribute('aria-busy', String(!ready));
      link.removeAttribute('target');
      link.querySelector('span').textContent = view?.button ?? copy.checkingRelease;
      if (!view) continue;
      link.href = view.href;
      link.title = view.asset?.name ?? view.button;
      if (view.asset) link.setAttribute('download', view.asset.name);
      else link.removeAttribute('download');
      link.querySelector('use')?.setAttribute('href', view.asset ? '#download-icon' : '#arrow-up');
    }
    if (ready && pending) {
      const link = pending;
      pending = null;
      link.click();
    }
  };
}
