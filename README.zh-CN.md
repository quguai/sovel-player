<p align="center"><img src="mobile/assets/icon.png" width="88" alt="Sovel HiFi 应用图标" /></p>
<h1 align="center">Sovel HiFi</h1>
<p align="center">收藏声音，慢慢聆听。</p>
<p align="center"><a href="README.md">English</a> · <strong>简体中文</strong></p>
<p align="center"><a href="https://sovel.quguai.cn/?lang=zh">官方网站</a></p>

Sovel HiFi 是一款正在开发的开源跨平台音乐播放器，面向本地与远程曲库。它将黑金曲库、可定制的黑胶外观和独立歌词页结合在一起，专注于你自己的音乐收藏。

**当前为开发预览版。** 本地曲库功能已实现，播放和原生 EQ 已在 iOS 模拟器验证。Android 签名 APK 已通过 GitHub Actions 构建；Android 真机播放与硬件行为仍需验证。Jellyfin / Emby 适配已在开发源码接入，真实服务器兼容性仍需验证；专用 HiFi 输出属于后续规划。应用界面目前使用简体中文，仓库文档提供中英文版本。

## 界面预览

| 音乐库 | 黑胶播放 | 同步歌词 |
| :---: | :---: | :---: |
| <img src="docs/images/library.png" width="240" alt="黑金音乐库与专辑卡片" /> | <img src="docs/images/vinyl.png" width="240" alt="居中黑胶与纤细唱臂" /> | <img src="docs/images/lyrics.png" width="240" alt="独立歌词页与当前行高亮" /> |

截图来自实际 iOS 模拟器，播放内容为项目原创试听曲。浏览器 DEMO 是独立的设计预览。

## 当前源码能力

源码能力与已发布 APK 可能不同。新增 Jellyfin / Emby 集成在纳入 Release 前需要从当前源码构建；下载安装包时请查看对应版本说明。

- **直接索引原文件。** 授权文件或文件夹后建立索引，音乐保留在原位置；复制到应用是单独、明确标注的操作。
- **扫描不重建曲库。** 先发现文件，再按固定总数导入。增量和全量扫描保留收藏与偏好，可过滤小文件、隐藏内容和子目录。
- **连接自己的音乐服务器。** 登录 Jellyfin / Emby，选择音乐库、同步索引并串流原音频。可勾选来源、调整优先级，重复歌曲合并展示且保留版本选择。
- **浏览音乐收藏。** 专辑、歌曲、艺术家、文件夹、搜索、收藏；专辑和艺术家的卡片／列表模式分别记忆。
- **定制播放外观。** 封面、唱片、沉浸大图、磁带四种画面；四款不同结构的磁带，横屏左侧磁带及控制区、右侧同步歌词；九种唱片材质、两种唱臂、唱头配色、针尖灯光和三档转速。关于页加入可轻触倾斜的 3D 品牌卡，减少动态效果时保持静态。
- **阅读与微调歌词。** 歌词、播放和歌曲详情分别成页，支持时间轴高亮、点击定位与单曲同步偏移。
- **接着上次的位置听。** 重启恢复队列、顺序、当前歌曲和进度，默认暂停；支持后台、锁屏控制和原生睡眠定时。
- **调整听感。** 原生十段图形均衡器、PEQ／AutoEQ 文本导入、ReplayGain、预设、前级增益和自动余量。iOS 处理链已验证，Android 集成待验证。
- **偏好保存在本机。** SQLite 保存曲库与收听记录；设置和 EQ 预设可导出 JSON，预览后恢复。本地精选使用标签、收藏和收听记录排序。

## 音乐来源

进入 **设置 → 音乐来源**，搜索局域网内的 **Jellyfin / Emby / DLNA**，选择服务器，登录后勾选音乐库或目录；也可以手动填写地址。**SMB、WebDAV、OpenSubsonic** 同样提供手动连接。支持带路径前缀的反向代理地址；每个选中的音乐库成为可独立启停、调整优先级的来源。来源以一行两张的精简卡片展示，点击卡片查看连接详情、勾选聚合、调整优先级或同步。点击 **同步曲库**，先完整发现曲目，再按固定总数显示元数据导入进度。

- **聚合展示，保留版本。** 匹配的副本合并为一行，点击来源／版本入口可选择并记住副本，也可恢复自动选择。Live、重制及不同发行版本不会仅凭同名合并。
- **默认选择有顺序。** 在可用且支持播放的副本中：记住的选择 → 无损 → 本地 → 来源优先级。没有单曲覆盖选择时，整张专辑优先使用同一来源的完整版本。
- **保留已有收藏。** 关闭来源保留索引与收藏。升级在原数据库上迁移，无需删库或从头重建；SQLite 分页与搜索索引减少浏览时读取完整元数据的开销。
- **先索引，再串流。** 当前远程同步完整分页枚举曲库并更新元数据，不是服务器增量变更订阅。播放请求原文件串流，不自动转码、不下载音频、无持久化串流缓存；仍受本机解码能力限制。
- **授权与记录留在本机。** Jellyfin/Emby Token 以及 SMB/WebDAV/OpenSubsonic 登录信息使用系统安全存储，不进入 SQLite 或设置备份；DLNA 无需账号。远程文件只读，收藏和收听记录不会回写服务器。

| 来源 | 发现与访问方式 |
| --- | --- |
| Jellyfin / Emby | 局域网 UDP 发现或手动 HTTP(S) 地址；登录后勾选音乐库 |
| DLNA / UPnP | SSDP 发现或设备描述 URL；勾选目录并读取 HTTP 音频，不包含投屏 |
| SMB | 手动 `smb://主机/Music` 共享目录地址，可指定端口、账号和域；SMB2+ 只读访问 |
| WebDAV | 手动 HTTP(S) 目录地址，可选 Basic 认证；目录扫描与 HTTP Range 标签读取 |
| OpenSubsonic | 手动服务器地址、账号和密码；勾选音乐文件夹，读取专辑和原文件串流 |

自动发现需要同一局域网、本地网络权限及服务器发现端口可达；路由器或容器屏蔽广播时仍可手动输入。iOS 真机发现还需要签名配置中获准使用 Apple multicast 权限。SMB/WebDAV 使用扫描规则先统计符合条件的文件，再按固定总数解析内嵌标签、歌词和封面，不向曲库复制音频。

以上能力已加入**开发源码**，不代表旧 APK 已包含。协议契约和 Swift/Kotlin 原生 SMB2、Range 读写测试使用本机测试服务；iOS 模拟器使用测试服务器联调。真实 NAS 部署和完整 Android 应用集成仍需验证。限制与复现步骤见[移动端说明](mobile/README.zh-CN.md#聚合曲库与媒体服务器)。

## 能力状态

| 能力 | 当前状态 |
| --- | --- |
| 本地文件／文件夹 | 已实现；iOS 就地访问与重启恢复已验证 |
| WAV / FLAC | 已用开发测试音频验证元数据与 iOS 播放 |
| DSF | Android / iOS 原生 DSD → PCM 软解；iOS 模拟器播放和进度恢复已验证，实际硬件输出待验证 |
| 其他音频格式 | 播放受平台与编码限制，不承诺所有变体均兼容 |
| 十段 EQ | 双端原生集成，iOS 处理链和预设已验证 |
| 后台播放／睡眠定时 | 已有原生实现，iOS 模拟器检查通过；真机仍需验证 |
| Jellyfin / Emby | 来源勾选、分页同步、聚合与原文件串流已实现；真实服务器验证待完成 |
| 局域网发现 / SMB / WebDAV / DLNA / OpenSubsonic | 开发源码已实现，本机协议和原生读写已测试；真机／NAS 兼容性待验证 |
| PEQ / AutoEQ / ReplayGain | 原生处理已实现，频响测量及 iOS 模拟器检查通过 |
| 主题配色 | 四种深色预设，自定义背景／强调色，支持记忆和备份 |
| USB 独占／DoP／原生 DSD | 规划中，需要 Android 与实际 DAC 验证 |
| Bit-perfect／严格无缝播放 | 当前版本尚未验证或承诺 |

界面中的源文件位深、采样率不代表 DAC 实际输出。元数据解析、音频解码和输出能力分别核对。具体限制见[移动端开发说明](mobile/README.zh-CN.md)。

## 版本发布与更新

前往[官网下载区](https://sovel.quguai.cn/?lang=zh#download)或 [GitHub Releases](https://github.com/quguai/sovel-player/releases)，选择并安装**一个** Android APK：

| 安装包后缀 | 适用设备 |
| --- | --- |
| `arm64-v8a.apk` | 支持 64 位 ARM 的安卓系统，支持时可选这个更小的包 |
| `armeabi-v7a.apk` | 32 位 ARM 安卓系统，包括部分较老的 HiFi 播放器 |
| `x86_64.apk` | x86_64 安卓模拟器及对应的 Intel / AMD 安卓设备 |
| `universal.apk` | 兼容以上三种架构，不确定时选择通用包 |

应以安卓**系统支持的架构**为准，不能只看处理器是否为 64 位。各包功能相同；以所选版本实际发布的文件为准，旧版本可能只有通用包。官网默认通用包，也会记住手动选择的架构；优先展示最新稳定版，没有稳定版时明确标注最新预览版，不通过浏览器猜测设备架构。iOS 不使用 APK，目前可通过源码构建体验。

应用内进入「**设置 → 版本更新**」。稳定版渠道不接收 Beta / RC，想体验预览版本请切换到「**测试版**」。支持架构识别的 Android 版本会自动匹配更新包，展示架构、大小与下载进度，校验后由用户确认安装，无需手动选架构或卸载重装。已经安装的旧客户端仍先通过通用包升级，升级后后续更新即可使用对应的小包。

推送 `vX.Y.Z` 标签后，GitHub Actions 自动检查、构建各架构正式签名 APK 并发布到 GitHub Releases；Beta / RC 标签发布为测试版。首次发布前需配置签名 Secrets，见[发布配置说明](docs/android-releases.md)。正式对外发布前仍需在 Android 真机验证覆盖升级。

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

本地文件从 **设置 → 文件扫描** 选择；Jellyfin / Emby 音乐库从 **设置 → 音乐来源** 添加。开发测试音频只保留在 `mobile/tests/fixtures`，不打进安装包，也不会由应用联网下载。

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
docs/         实现说明与截图
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

运行以上命令查看当前测试数量与诊断结果。核心覆盖包括真实 SQLite 迁移与分页、聚合、来源选择及 Jellyfin / Emby HTTP 契约。iOS 模拟器覆盖本地聆听，以及使用模拟服务器的远程登录、同步、版本选择和播放。真实服务器部署、本次集成的 Android 验证和 USB DAC 输出仍待完成。原生测试命令见[开发说明](mobile/README.zh-CN.md)。

欢迎贡献。反馈播放问题时，请提供复现步骤、设备、系统和音频格式；原生音频改动需附对应平台的验证结果。

## 后续计划

- 扩展真实 NAS／媒体服务器兼容性与断网恢复验证，逐项评估其他来源适配器。
- 在 Android 真机上验证播放、SAF／SD 卡访问、中断与后台行为。
- 扩展 DSD 与更多无损格式的解码和输出，按设备报告真实能力。
- 实现并验证 Android USB 独占及厂商内置 DAC 输出链路。
- 增加歌曲过渡、按输出设备记忆预设与更多应用语言。

## 素材与许可

项目使用 [MIT 许可证](LICENSE)，保留现有第三方声明，包括 [Expo 初始模板许可](mobile/LICENSE)。

生成的图标、唱片和缺省图片在 [mobile/assets](mobile/assets) 中保留素材来源记录；试听曲由本项目合成。浏览器概念摄影来自 Unsplash：[海面](https://images.unsplash.com/photo-1475924156734-496f6cac6ec1)、[山景](https://images.unsplash.com/photo-1464822759023-fed622ff2c3b)、[森林](https://images.unsplash.com/photo-1441974231531-c6227db76b6e)、[沙丘](https://images.unsplash.com/photo-1509316785289-025f5b846b35)。
