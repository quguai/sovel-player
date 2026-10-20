<p align="center"><img src="mobile/assets/icon.png" width="88" alt="Sovel HiFi 应用图标" /></p>
<h1 align="center">Sovel HiFi</h1>
<p align="center">收藏声音，慢慢聆听。</p>
<p align="center"><a href="README.md">English</a> · <strong>简体中文</strong></p>
<p align="center"><a href="https://sovel.quguai.cn/?lang=zh">官方网站</a></p>

Sovel HiFi 是一款正在开发的开源跨平台音乐播放器，面向本地与远程曲库。它将黑金曲库、可定制的黑胶外观和独立歌词页结合在一起，专注于你自己的音乐收藏。

**当前为开发预览版。** 本地曲库功能已实现，播放和原生 EQ 已在 iOS 模拟器验证。仓库包含 Android 实现，但 Android 构建和硬件行为仍需验证。远程曲库与专用 HiFi 输出属于后续规划。应用界面目前使用简体中文，仓库文档提供中英文版本。

## 界面预览

| 音乐库 | 黑胶播放 | 同步歌词 |
| :---: | :---: | :---: |
| <img src="docs/images/library.png" width="240" alt="黑金音乐库与专辑卡片" /> | <img src="docs/images/vinyl.png" width="240" alt="居中黑胶与纤细唱臂" /> | <img src="docs/images/lyrics.png" width="240" alt="独立歌词页与当前行高亮" /> |

截图来自实际 iOS 模拟器，播放内容为项目原创试听曲。浏览器 DEMO 是独立的设计预览。

## 当前可以体验

- **直接索引原文件。** 授权文件或文件夹后建立索引，音乐保留在原位置；复制到应用是单独、明确标注的操作。
- **扫描不重建曲库。** 先发现文件，再按固定总数导入。增量和全量扫描保留收藏与偏好，可过滤小文件、隐藏内容和子目录。
- **浏览音乐收藏。** 专辑、歌曲、艺术家、文件夹、搜索、收藏；专辑和艺术家的卡片／列表模式分别记忆。
- **定制播放外观。** 封面、唱片、沉浸大图三种画面；九种唱片材质、两种唱臂、唱头配色、针尖灯光和三档转速。
- **阅读与微调歌词。** 歌词、播放和歌曲详情分别成页，支持时间轴高亮、点击定位与单曲同步偏移。
- **接着上次的位置听。** 重启恢复队列、顺序、当前歌曲和进度，默认暂停；支持后台、锁屏控制和原生睡眠定时。
- **调整听感。** 原生十段图形均衡器、六个内置预设、自定义预设、前级增益和自动余量。iOS 处理链已验证，Android 集成待验证。
- **偏好保存在本机。** SQLite 保存曲库与收听记录；设置和 EQ 预设可导出 JSON，预览后恢复。本地精选使用标签、收藏和收听记录排序。

## 能力状态

| 能力 | 当前状态 |
| --- | --- |
| 本地文件／文件夹 | 已实现；iOS 就地访问与重启恢复已验证 |
| WAV / FLAC | 已用开发测试音频验证元数据与 iOS 播放 |
| DSF | ID3、封面与歌词解析已验证；尚未开放播放 |
| 其他音频格式 | 播放受平台与编码限制，不承诺所有变体均兼容 |
| 十段 EQ | 双端原生集成，iOS 处理链和预设已验证 |
| 后台播放／睡眠定时 | 已有原生实现，iOS 模拟器检查通过；真机仍需验证 |
| SMB / WebDAV / DLNA / OpenSubsonic | 规划中 |
| PEQ / AutoEQ / ReplayGain | 规划中 |
| USB 独占／DoP／原生 DSD | 规划中，需要 Android 与实际 DAC 验证 |
| Bit-perfect／严格无缝播放 | 当前版本尚未验证或承诺 |

界面中的源文件位深、采样率不代表 DAC 实际输出。元数据解析、音频解码和输出能力分别核对。具体限制见[移动端开发说明](mobile/README.zh-CN.md)。

## 版本发布与更新

推送 `vX.Y.Z` 标签后，GitHub Actions 自动检查、构建正式签名 APK 并发布到 GitHub Releases；Beta / RC 标签发布为测试版。Android GitHub 版在「设置 → 版本更新」支持检查版本、发布说明、校验下载及用户确认安装。首次发布前需配置签名 Secrets，见[发布配置说明](docs/android-releases.md)。正式对外发布前仍需在 Android 真机验证覆盖升级。

## 构建原生应用

使用 [mobile/package.json](mobile/package.json) 声明支持的 Node.js，例如 22.x 中的 22.13 或更新版本，以及 npm。iOS 需要 macOS、Xcode 与 CocoaPods；Android 需要 JDK 21、Android SDK 和设备或模拟器。

```sh
git clone https://github.com/quguai/sovel-player.git
cd sovel-player/mobile
npm ci
```

iOS：

```sh
cd ios
pod install
cd ..
npm run ios
```

Android：

```sh
npm run android
```

`npm start` 可单独启动 Metro。本项目包含自定义原生模块，必须使用原生开发构建，**不能直接用 Expo Go 运行**。原生工程已提交，日常开发不需要重新 Prebuild；安装和启动脚本会自动应用维护中的音频集成补丁。

从 **设置 → 文件扫描** 选择自己的音乐文件或目录。开发测试音频只保留在 `mobile/tests/fixtures`，不打进安装包，也不会由应用联网下载。

## 体验浏览器 DEMO

在仓库根目录运行：

```sh
npm run dev
```

打开 [localhost:4786](http://localhost:4786)。网页预览无需安装依赖，服务器仅监听本机；可使用 `PORT=4787 npm run dev` 更换端口。

浏览器预览独立保存状态，不共享原生 SQLite 曲库。示例歌曲与音质标签用于设计展示，不代表原生音频处理或硬件输出能力。

## 产品网站

中英文产品网站位于 [`site/`](site)。运行 `npm run site:dev` 本地预览，运行 `npm run site:build` 生成适用于 Cloudflare Pages 的 `dist/`。部署参数、GitHub Star 数和最新 Release 下载逻辑详见[网站部署说明](site/README.md)。

## 开发

| 部分 | 当前实现 |
| --- | --- |
| 界面与业务 | React Native 0.88、React 19.3、TypeScript、Expo SDK 58 |
| 曲库与偏好 | `expo-sqlite` 提供 SQLite 存储 |
| 元数据 | `music-metadata` 与随机读取 tokenizer |
| 播放 | `expo-audio` 58.0.9；iOS AVFoundation、Android Media3 |
| 图形均衡器 | 共用 C++ DSP 与双端原生适配 |
| 文件访问 | Android SAF 与 iOS 安全作用域书签模块 |

```text
mobile/       React Native 应用、原生工程、DSP 与测试
docs/         实现说明、参考项目核查与截图
design/       图标和素材设计探索
previews/     浏览器设计预览图片
app.js        浏览器交互 DEMO
styles.css    浏览器 DEMO 样式
```

在 `mobile/` 中运行：

```sh
npm run check    # TypeScript 与核心测试
npm run lint     # ESLint
```

当前 54 项核心测试与 TypeScript 检查通过，ESLint 无错误、保留 7 条现有警告。iOS 模拟器验证覆盖本地导入、播放、歌词、扫描、重启恢复、均衡器与预设。Android 硬件和 USB DAC 输出尚未验证。原生测试命令见[开发说明](mobile/README.zh-CN.md)。

欢迎贡献。反馈播放问题时，请提供复现步骤、设备、系统和音频格式；原生音频改动需附对应平台的验证结果。用于研究的参考仓库放在已忽略的 `repos/`，不作为依赖或子模块分发。

## 后续计划

- 接入 SMB、WebDAV、DLNA/UPnP 和 OpenSubsonic 远程曲库，其他服务器适配器单独评估。
- 在 Android 真机上验证播放、SAF／SD 卡访问、中断与后台行为。
- 扩展 DSD 与更多无损格式的解码和输出，按设备报告真实能力。
- 实现并验证 Android USB 独占及厂商内置 DAC 输出链路。
- 增加 PEQ、AutoEQ 导入、ReplayGain、歌曲过渡与更多应用语言。

## 致谢与许可

项目使用 [MIT 许可证](LICENSE)，保留现有第三方声明，包括 [Expo 初始模板许可](mobile/LICENSE)。

[NeriPlayer](https://github.com/cwuom/NeriPlayer)、[MusicFree](https://github.com/maotoumao/MusicFree)、[Auxio](https://github.com/oxycblt/auxio) 用于功能与行为研究，未复制其 GPL／AGPL 实现代码。[music-metadata](https://github.com/Borewit/music-metadata) 是实际依赖。范围与归属详见[参考仓库目录](docs/upstream-references.md)和[功能采用核查](docs/feature-adoption-review.md)。

生成的图标、唱片和缺省图片在 [mobile/assets](mobile/assets) 中保留素材来源记录；试听曲由本项目合成。浏览器概念摄影来自 Unsplash：[海面](https://images.unsplash.com/photo-1475924156734-496f6cac6ec1)、[山景](https://images.unsplash.com/photo-1464822759023-fed622ff2c3b)、[森林](https://images.unsplash.com/photo-1441974231531-c6227db76b6e)、[沙丘](https://images.unsplash.com/photo-1509316785289-025f5b846b35)。
