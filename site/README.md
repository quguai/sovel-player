# Sovel HiFi website

An independent static product website for [Sovel HiFi](https://github.com/quguai/sovel-player). English is the default, with a remembered Simplified Chinese switch and shareable `?lang=zh` links. No framework, bundler, runtime dependencies, analytics or server is required in production.

## Capability documentation

Keep feature updates aligned across `index.html` (English and no-JavaScript fallback), `copy.js` (Simplified Chinese and search/social descriptions), and the English/Chinese root and mobile READMEs. `#music-sources` explains Jellyfin / Emby connections, source selection, aggregation and original-file streaming; the FAQ explains duplicate-version defaults. It is an editorial feature overview, not an interactive server-connection demo.

Distinguish **implemented in development source**, **available in a published APK**, and **verified on real hardware/servers**. The new remote integration has mock-server iOS simulator coverage; real Jellyfin / Emby deployments and Android integration remain unverified. The download card explicitly directs users to the selected release notes for availability. DLNA / UPnP, SMB, WebDAV and OpenSubsonic remain planned. Keep release fetching and ABI selection automatic; do not hardcode a new version or APK URL for a feature announcement.

新增能力需要同步根目录与移动端的中英文 README，以及网站的英文 HTML、中文文案和搜索／分享描述。远程曲库说明位于 `#music-sources`，明确区分开发源码、已发布安装包与真实服务器／硬件验证；不要把模拟服务器联调写成真实服务器兼容性验证，也不要把规划中的协议写成已支持。

## Local preview

From the **repository root** (Node.js 22 or newer):

```sh
npm run site:dev
```

Open `http://localhost:4788`. This is the website; the existing player design demo remains on port 4786.

```sh
npm run site:check
npm run site:build
npm run site:preview
```

The production output is **`dist/`**. `site:preview` serves it with the same static security headers as the deployment. Stop `site:dev` before starting `site:preview`, since both use port 4788. `PORT` can override the port.

## Deploy to Cloudflare Pages

Connect the `quguai/sovel-player` GitHub repository to Cloudflare Pages using Git integration:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | **None** |
| Root directory | Repository root; leave blank |
| Build command | `npm run site:build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION=22` |
| Optional environment variable | `SITE_URL=https://sovel.quguai.cn` (already the default) |

The official website is **https://sovel.quguai.cn**. Every build generates the canonical URL, Open Graph page and image URLs, sitemap, and sitemap entry in `robots.txt` using this origin. `SITE_URL` can override it for a separate deployment; rebuild after changing it.

After the first Pages deployment, open **Custom domains → Set up a domain** and enter `sovel.quguai.cn`. If `quguai.cn` is managed in the same Cloudflare account, confirm the automatically proposed DNS record. Otherwise, add a `CNAME` named `sovel` at your DNS provider, pointing to the exact `<project>.pages.dev` hostname assigned to your Pages project. Add the domain in Pages first; a DNS record alone does not associate it with the project. Wait for the custom domain to become active. See [Cloudflare custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).

For Direct Upload, run `npm run site:build` and upload the **contents of `dist/`**, or a ZIP whose root contains `index.html`, `_headers`, and `assets/`. Never upload the whole repository or `mobile/`. Cloudflare will serve `404.html` for missing pages; this site does not need an SPA rewrite or Pages Functions.

References: [Cloudflare static HTML](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/), [custom headers](https://developers.cloudflare.com/pages/configuration/headers/).

## Deploy through the Workers creation screen

The Cloudflare screen with **Deploy command** and **Preview command** creates a Worker. This site also supports Workers Static Assets using the root `wrangler.json`; no Worker script is required.

| Setting | Value |
| --- | --- |
| Worker name | `sovel-player` |
| Root directory | Repository root |
| Production branch | `main` |
| Build command | Leave blank; Wrangler runs `npm run site:build` through `build.command` |
| Deploy command | `npx wrangler deploy --config wrangler.json` |
| Preview command | `npx wrangler preview --config wrangler.json` |
| Environment variable | `NODE_VERSION=22` |

Only `dist/` is uploaded. Do not set `--assets .` or use the repository root as the asset directory: that includes unrelated source files and `node_modules`, and can exceed the 25 MiB per-file limit. If a command was automatically generated before `wrangler.json` existed, replace it with the commands above and deploy the latest commit.

For this Workers deployment, bind `sovel.quguai.cn` under **Settings → Domains & Routes → Add → Custom Domain**; the Pages custom-domain instructions above apply only to Pages projects. See [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/get-started/) and [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

## GitHub stars and release downloads

`github.js` reads the public GitHub API, with no token or build secrets:

- Repository `stargazers_count` is displayed as the real Star count, including zero. Unknown or failed counts display `—`; the GitHub link still works.
- Prefer `/releases/latest` (latest stable release). If no stable release exists, read the newest published entry from the first 20 releases and clearly label prereleases **Preview**.
- A published, uploaded universal `.apk` is the safe default. The Android package selector offers universal, ARM64, ARM32 and x86_64, enabling only files actually published in the selected release. Recognized architecture-specific packages require a user choice when no universal package exists; the site never infers the Android ABI from the browser. Legacy single APKs without a recognized suffix remain supported.
- An explicit package choice is remembered locally and applies to every download button, filename and size. If that package is unavailable in a later release, fall back to universal when available and explain the fallback. Universal-only releases remain downloadable and are clearly identified. Duplicate ABI assets and links whose tag/filename do not match the release are not guessed.
- Display the actual tag, publication date and package size. Download points to the asset’s `browser_download_url`, not a guessed tag or filename. Release notes link to that specific release.
- All “Get Sovel” entries download the APK directly in the current tab. Clicking while release information is loading waits for the resolved URL; it does not scroll to the download section. The buttons show “View releases” only when a direct APK is unavailable.
- No release: show an explicit coming-soon state with Releases/source links. API timeout, rate limit or invalid response: show a GitHub fallback instead of claiming no release exists.
- Each successful API response is cached in that browser tab’s session storage for five minutes. Failed requests are not cached. Changes may take up to five minutes to appear in an already-open session; reload after the cache expires.
- The API timeout is eight seconds per request. Stars and release requests fail independently. Only HTTPS links under this repository’s GitHub Releases paths are accepted.

The site fetches information when opened, so publishing a release does **not** require rebuilding the website. Public GitHub API availability and unauthenticated rate limits apply. iOS is linked to source build instructions; Android APKs are never presented as iOS downloads.

## Screens and visual assets

Inside is a seven-scene scroll presentation: library → classic black vinyl → smoked vinyl → ice blue vinyl → cover → immersive → lyrics. Native document scrolling advances the full-viewport stage; after the last scene, the page continues into downloads. The player shell stays in place as the app screens and accompanying text crossfade. There are no wheel/touch handlers or forced scroll snaps. The native screenshots are displayed in an original CSS mockup inspired by the [Sony NW-WM1ZM3](https://www.sony.com.cn/content/sonyportal/zh-cn/cms/newscenter/product/2026/20261016-1.html). The iOS status bar is cropped in CSS. This is a conceptual presentation, not a hardware compatibility test or a Sony affiliation. Vendor product photographs are not bundled.

- `screen-library.png`, `screen-player.png`, `screen-lyrics.png`: captured native application screens also used in `docs/images/`.
- `screen-black.png`, `screen-blue.png`, `screen-cover.png`, `screen-immersive.png`: additional native iOS simulator captures of the project’s original listening samples, captured for this site.
- Icon and turntable textures: reused from `mobile/assets/`; their generation provenance is recorded there.
- Hero cover photography: [Unsplash ocean](https://images.unsplash.com/photo-1475924156734-496f6cac6ec1). Sample mountain artwork appears only inside actual app screenshots.
- Instrument Serif and Manrope fonts are self-hosted. Their OFL licenses are included in `assets/fonts/`.

The hero turntable is an appearance preview and does not play audio. Motion respects reduced-motion preferences and pauses when the page or preview is hidden. Appearance controls and language selection work by keyboard. The presentation follows ordinary scrolling, including Page Down / Page Up. “View all screens” switches to a stacked reading layout. Without JavaScript or with reduced motion enabled, all seven scenes are readable in that layout by default. Compact portrait and short landscape screens use separate compositions. Screen captures are decoded when the presentation approaches the viewport; progress is updated in requestAnimationFrame and only opacity/transform animate. Runtime GitHub text is rendered as text, not HTML.

## 项目说明

网站源码在 `site/`，英文默认展示，可切换简体中文。部署时使用仓库根目录，构建命令为 `npm run site:build`，产物目录为 `dist`，适用于 Cloudflare Pages。

正式域名为 **https://sovel.quguai.cn**，构建默认生成对应的 canonical、Open Graph 地址、sitemap 和 robots.txt，无需额外设置 `SITE_URL`。首次部署后在 Pages 项目的「自定义域 → 设置域」中绑定 `sovel.quguai.cn`，按提示确认或添加 CNAME，并等待域名状态变为有效。

Star 数和 Android 下载入口实时读取公开 GitHub 数据，缓存五分钟。正式版优先；没有正式版时展示最新预览版并明确标识。尚无安装包时显示“首个版本准备中”，接口失败时保留 GitHub Releases 入口。发布新版本后，无需重建网站。

Inside 通过原生滚动依次展示七幕真实应用截图：曲库、三种黑胶、封面、沉浸与歌词。画面固定在视口内，展示结束后继续进入下载区；支持向上回看与“展开全部画面”。关闭 JavaScript 或启用减少动态效果时，默认展示普通纵向排版。使用参考金砖三代外形的 CSS 概念机身。外壳仅用于展示，不代表已通过该设备兼容性测试。
