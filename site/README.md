# Sovel HiFi website

An independent static product website for [Sovel HiFi](https://github.com/quguai/sovel-player). English is the default, with a remembered Simplified Chinese switch and shareable `?lang=zh` links. No framework, bundler, runtime dependencies, analytics or server is required in production.

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
| Optional environment variable | `SITE_URL=https://your-real-domain.example` |

Replace the example domain with the deployed HTTPS domain. Setting `SITE_URL` generates the canonical URL, sitemap, absolute Open Graph image URL and sitemap entry in `robots.txt`. Without it, the site works normally and does not invent a public domain. Rebuild after changing it.

For Direct Upload, run `npm run site:build` and upload the **contents of `dist/`**, or a ZIP whose root contains `index.html`, `_headers`, and `assets/`. Never upload the whole repository or `mobile/`. Cloudflare will serve `404.html` for missing pages; this site does not need an SPA rewrite or Pages Functions.

References: [Cloudflare static HTML](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/), [custom headers](https://developers.cloudflare.com/pages/configuration/headers/).

## GitHub stars and release downloads

`github.js` reads the public GitHub API, with no token or build secrets:

- Repository `stargazers_count` is displayed as the real Star count, including zero. Unknown or failed counts display `—`; the GitHub link still works.
- Prefer `/releases/latest` (latest stable release). If no stable release exists, read the newest published entry from the first 20 releases and clearly label prereleases **Preview**.
- A published, uploaded universal `.apk` is preferred. A single APK is also supported and its actual filename is shown. If several ABI-specific APKs exist without a universal package, link to the release so visitors can choose the correct file.
- Display the actual tag, publication date and package size. Download points to the asset’s `browser_download_url`, not a guessed tag or filename. Release notes link to that specific release.
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

Star 数和 Android 下载入口实时读取公开 GitHub 数据，缓存五分钟。正式版优先；没有正式版时展示最新预览版并明确标识。尚无安装包时显示“首个版本准备中”，接口失败时保留 GitHub Releases 入口。发布新版本后，无需重建网站。

Inside 通过原生滚动依次展示七幕真实应用截图：曲库、三种黑胶、封面、沉浸与歌词。画面固定在视口内，展示结束后继续进入下载区；支持向上回看与“展开全部画面”。关闭 JavaScript 或启用减少动态效果时，默认展示普通纵向排版。使用参考金砖三代外形的 CSS 概念机身。外壳仅用于展示，不代表已通过该设备兼容性测试。
