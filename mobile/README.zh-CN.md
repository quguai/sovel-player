# Sovel HiFi · Mobile

本文描述当前源码。新增 Jellyfin / Emby 集成在纳入 Release 前需要原生构建；APK 是否包含请查看对应版本说明。iOS 模拟器使用模拟服务器联调，真实 Jellyfin / Emby 部署与本次集成的 Android 验证仍待完成。

[English](README.md) · **简体中文** · [项目介绍](../README.zh-CN.md)

Sovel HiFi 的 React Native + TypeScript 实现。本目录包含应用、已提交的 iOS／Android 工程、原生音频扩展与测试；根目录网页 DEMO 为独立的视觉参考。

## Android 发布与更新

根目录的 [Android 发布流水线](../.github/workflows/android-release.yml) 监听 `v*` 标签，验证版本、执行检查、构建签名 APK 并发布到 GitHub Releases。GitHub Android 版支持「设置 → 版本更新」。首次发布需配置 4 个签名 Secrets，详见[发布配置及更新行为](../docs/android-releases.md)。

## 运行

使用 [package.json](package.json) 声明的 Node.js：`^22.13.0 || ^24.3.0 || >=26.0.0`，以及 npm。iOS 需要 macOS、Xcode、CocoaPods；Android 需要 JDK 21、Android SDK 和设备或模拟器。

在本目录运行：

```sh
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

`npm start` 可单独启动 Metro。本项目需要原生开发构建，不能用 Expo Go 运行。原生依赖变化后需重新编译，iOS 同时运行 `pod install`。原生工程已经纳入版本管理，日常不需要重新 Prebuild。改名或依赖变化后若 Metro 缓存旧模块，可用 `npm start -- --clear` 重启。

| 标识 | 当前值 |
| --- | --- |
| 桌面名称 | Sovel HiFi |
| 字标／原生工程 | Sovel |
| Android application ID／iOS Bundle ID | `cn.quguai.music.sovel` |
| URL scheme | `sovel://` |
| SQLite 文件 | `sovel.db`，结构版本 5 |

未发布阶段的品牌切换采用新应用身份和新数据库，不保留旧品牌运行时迁移。数据库结构升级与品牌改名是两件事，普通扫描仍在现有数据库上更新。

## 开发测试音频

仓库保留两段本项目合成的 24 秒音频，只放在 `tests/fixtures` 中供开发和元数据测试；不随安装包分发，应用中不提供试听导入或联网下载入口。模拟器测试时先安装应用，执行 `sh scripts/prepare-listening-fixtures.sh`，再到「设置 → 文件扫描」扫描应用文件。

| 文件 | 内嵌曲名／歌手／专辑 | 音频参数 |
| --- | --- | --- |
| `tests/fixtures/sample.wav` | 初见 / Sovel / 声音手记 | PCM WAV、16 bit、44.1 kHz、立体声 |
| `tests/fixtures/sample.flac` | 微光 / Sovel / 声音手记 | FLAC、16 bit、44.1 kHz、立体声 |

两份样本均含封面和时间轴歌词，用于交互与元数据验证，不是商业歌曲或 Hi-res 母带。`npm run fixtures` 可重新生成，FLAC 生成需要 FFmpeg。`tests/tagged.dsf` 是标签解析测试文件，不是 DSD 播放演示。

播放页点击格式／采样率一行，可查看文件信息。显示的位深和采样率属于源文件，不代表 DAC 实际输出。

## 文件与扫描

选择文件或添加文件夹默认索引原音频，不复制、不改写标签。

- Android 使用 SAF 文件／目录选择器及持久化 URI 权限，直接使用提供方返回的 `content://` URI。
- iOS 本地 `SovelAccess` 模块通过 `UIDocumentPicker` 就地访问并保存安全作用域书签，重启后恢复访问，为原生播放保留作用域。
- SQLite 保存来源身份、路径／URI、大小、修改时间、标签、歌词、收藏和偏好。封面单独缓存，音频不写入数据库。
- 文件夹授权可发现新增歌曲与同名 `.lrc`；单文件授权只索引所选文件。
- 移动／改名目前按新路径处理，旧记录保留为缺失。重叠来源保留各自物理索引，匹配的歌曲在聚合视图合并展示，不复制音频。
- 存储离线、权限撤销或文件删除时保留索引和收藏。重新连接后扫描；权限失效时重新选择来源。
- **复制音乐到应用** 是单独的可选动作。iOS 可从「文件 → Sovel HiFi → Music」访问。
- 云盘文件提供方可能自行下载或缓存文件；此文件导入入口面向可随机读取的本地文件；Jellyfin / Emby 使用独立适配器，不自动镜像服务器音频。

所有来源共用一个数据库。扫描先完整枚举选定范围、应用过滤规则，再按固定总数导入。设置包含最小文件大小、忽略隐藏内容及是否包含子目录。来源管理中的授权选择不自动启动扫描，快捷导入动作则会执行增量扫描。

| 扫描方式 | 行为 |
| --- | --- |
| 增量 | 枚举来源，重新解析新增、变化或修改时间不可信的文件 |
| 全量 | 完整枚举，重读全部符合规则的标签、封面和歌词 |
| 强制刷新标签 | 不依赖缓存的大小／修改时间，重新读取元数据 |

已有曲目身份保留，重扫不覆盖收藏、歌词偏移和收听历史。只有完整枚举成功后才能标记歌曲缺失；缩小过滤范围不会删除旧记录。解析失败保留旧标签并重试。多来源逐个提交，取消时保留已完成来源的更新。系统终止的扫描标记中断，需重新启动；暂未实现目录监听或跨进程续扫。

## 页面与播放

- 黑金曲库包含专辑、歌曲、艺术家、文件夹、搜索与收藏；专辑／艺术家的卡片和列表模式分别记忆。
- 紧凑迷你播放条包含旋转小黑胶与文字导航。缺省封面和头像是共用打包资源，稳定分配，不联网、不按曲目复制。真实内嵌图片优先，歌手头像与专辑封面分开处理。
- 三种主页及封面／唱片／沉浸三种播放画面；九种唱片材质、两种唱臂、六种唱头颜色、独立灯光及三档转速，设置页和播放外观面板共用偏好。衣服图标打开外观面板。
- 歌曲详情、播放、歌词横向排列，默认停在中间。左滑进入歌词，右滑进入详情，顶部圆点可跳转。竖屏三页共用进度和播放控制；横屏采用分栏，遵循减少动态效果偏好。
- 详情包含歌手／专辑入口、带真实收录曲目数的专辑卡片、相关本地歌曲、音频参数，以及文件名／路径／修改时间，不编造未知信息。
- 原生队列支持跳转、上一首／下一首、随机／列表／单曲循环，已接入后台和锁屏控制。关闭后台播放后离开应用会暂停，返回时不自动出声。
- 重启恢复队列 ID、原始／随机顺序、歌曲和进度，默认暂停。离线歌曲保留原队列记录，必要时选择下一首可播放歌曲。原生位置记录使用队列 token 拒绝旧记录，通常约两秒保存一次。
- 时间轴歌词支持高亮和点击定位；无时间戳时静态显示。单曲偏移范围 ±30 秒，每次调整 0.2 秒，正值表示歌词提前，点击定位使用反向偏移。覆盖值保存在独立 SQLite 表，重扫保留。

### 原生睡眠定时

提供 15／30／60／90 分钟、自定义 1–180 分钟与取消。iOS 使用连续单调时钟与 DispatchSource；Android 使用 `elapsedRealtime` 和主线程 Handler，JS 仅展示剩余时间。暂停、切歌和锁屏不会重置截止时间。当前只支持到时暂停，尚无播完本曲／播完队列模式。定时仅属于本次会话，随应用进程退出结束；真机后台行为仍需验证。

### 设置备份

「设置 → 备份与恢复」导出外观、播放偏好、扫描规则、EQ 参数、自定义预设和曲库展示方式。恢复时先校验版本、大小和参数，展示替换摘要后再应用。

文件写入 `Documents/Backups`，通过系统分享保存。不包含音频、收藏、队列／进度、歌词偏移、收听历史、来源地址和访问授权；取消导入不更改设置，换设备需重新授权文件。

## 十段均衡器

「设置 → 均衡器」提供 31.25 Hz–16 kHz 十段、每段 ±12 dB、六个内置预设、最多 30 个自定义预设和 −24–0 dB 前级增益。关闭保留曲线，切换预设不自动开启 EQ。

共用 C++ 实现采用 [W3C Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/) 的峰值滤波器，自动余量估算叠加频响最大提升并降低前级。参数过渡约 40 ms，最终超限采样截断；不是动态压缩器或真峰值限制器。

- `native/equalizer/` 支持交错／分平面 PCM 16／24／32 bit 和 float32。关闭／中性设置在过渡后旁路，高于当前奈奎斯特限制的频段跳过。
- iOS 通过 `AVPlayerItem.audioMix` 和 `MTAudioProcessingTap` 接入，AVFoundation 仍持有解码、会话、队列与媒体控制。
- Android 经 Media3 `ForwardingAudioSink` 与 JNI 接入同一 DSP；此路径关闭编码直通和硬件 offload，避免绕过处理，并不提供 USB 独占。
- 界面显示的处理格式是 DSP 输入，不是 DAC 输出。开启 EQ 会改变采样，关闭本级 DSP 也不能证明整条链路 bit-perfect。

`scripts/patch-audio-equalizer.mjs` 和 `scripts/patch-audio-playback.mjs` 按顺序向固定的 **`expo-audio@58.0.9`** 应用原生集成，安装／启动脚本自动执行，可重复运行。音频包明确从源码编译，升级时需核对补丁锚点和原生行为；OTA 更新不能增加这些原生能力。

## PEQ、AutoEQ 与回放增益

「设置 → PEQ / AutoEQ」最多支持十段峰值／低架／高架滤波器（PK / LSC / HSC），频率 10–24000 Hz、增益 ±24 dB、Q 值 0.1–20。可导入本地 Equalizer APO / AutoEq 参数 TXT，或粘贴文本；不支持的类型和越界参数会报错。导入替换当前 PEQ，不会自动联网下载耳机预设。图示 EQ 与 PEQ 在原生 DSP 中叠加，自动余量估算整条滤波链的频响。

「设置 → 高级设置」提供关闭／按歌曲／按专辑 ReplayGain、±12 dB 前级和标签峰值保护。缺少专辑标签时回退到歌曲标签，没有增益标签时保持原音量。已有文件需要全量扫描以读取新字段；本地及 SMB／WebDAV 文件标签扫描可提供这些信息，未返回增益标签的服务器曲库不做归一化。队列增益由原生层执行，不依赖 JS 定时器；iOS 提前缓冲的每个曲目使用独立增益。峰值保护依赖文件标签，不是实时真峰值限制器。新设置纳入备份，旧 v1 备份自动迁移，不改动音乐和收藏。

按输出／设备记忆预设尚未实现。NeriPlayer 用于预设和生效状态的行为参考，未复制其实现或完整音效预设；DSP 使用公开的 W3C 公式，AutoEq 用于文本格式参考。

## 自定义主题配色

「设置 → 样式管理」提供黑金／深海／松影／暮色四种预设。自定义六位十六进制背景色和强调色，检查深色背景与对比度；保存后立即生效，重启记忆并纳入设置备份。封面驱动的播放器背景保持独立，暂不包含浅色／图片主题。

关于页使用 `src/ui/AboutBrandCard.tsx`：轻触倾斜、分层视差、随触点移动的高光与松手回弹。只观察触摸，不抢占页面纵向滚动；尊重减少动态效果，无闲置循环动画或运动传感器依赖。版本与开源许可仍独立展示。

## 收听历史与本地精选

SQLite `listening_history` 保存真实收听时长、去重音频覆盖、拖动次数与结束原因。原生单调时钟采样排除暂停和缓冲，拖动时调整采样锚点。重复播放同一区间增加时长，不重复累计完成率；未知总时长保持未知。

原生约每五秒、暂停和切歌时保存快照，JS 分批入库后确认 revision，避免重复累计。异常退出可能丢失最近一个未保存间隔。历史重扫保留，可从「设置 → 听歌记录与偏好」分页查看，应用不上传这些记录。

每日精选按本地日期保持固定，最多 30 首可播放歌曲。猜你喜欢综合标签、歌手／专辑关系、收藏及近 90 天收听证据，近 30 天权重更高。这是本地规则排序，不是在线推荐或音频内容识别；完整历史不会因排序窗口而删除。

## 格式与输出边界

WAV／FLAC 的标签与 iOS 播放已用样本验证，DSF 的 ID3、封面和歌词解析有测试。MP3、AAC、ALAC、AIFF、Ogg、Opus 等仍受平台／编码限制。Android 已接入 DSF → 浮点 PCM 软解，仅包含解码模块的原生包开放播放；支持单声道／立体声以及可配置的 PCM 采样率，真机播放和实际输出仍需验证。iOS 复用同一解码器，通过可跳转的虚拟 CAF 流分块输出，不生成整曲 PCM 副本；模拟器播放及恢复位置已通过。HTTP 来源必须支持精确 Range，远程 DSF 与真机兼容性还需验证。DFF／APE／WavPack 可以索引，但尚未开放播放。未集成 TagLib 或 FFmpeg 播放后端。

Jellyfin / Emby 曲库同步和原文件串流已在开发源码接入，真实服务器与 Android 集成验证待完成。USB 独占、DoP／原生 DSD、内置 DAC 厂商适配、bit-perfect 检测、严格无缝播放、淡入淡出、主题图片／浅色主题及更多应用语言尚未实现。USB DAC 当前走系统音频，长时间后台、中断、蓝牙和物理输出仍需真机验证。

## 验证

```sh
npm run check
npm run lint
npm run test:dsd:stream # macOS: virtual CAF, seek and Apple AudioFile validation
```

运行以上命令查看当前测试数量、TypeScript 诊断与 ESLint 警告。测试使用真实 SQLite 与 WAV／FLAC／DSF 标签样本，覆盖扫描、取消／离线、来源身份、结构升级、历史、队列恢复、备份、歌词偏移、精选、缺省素材，以及曲库分页、聚合与媒体服务器 HTTP 契约。

可选的 JS 资源导出检查：

```sh
npx expo export --platform ios --platform android --output-dir artifacts/bundles
```

资源导出不代表 Android 原生编译或设备播放通过。现有 iOS 模拟器检查覆盖导入、真实进度、WAV／FLAC 切换、歌词、扫描、重启恢复、EQ／预设、原生定时、备份流程与曲库视图；改名回归通过本地播放／重启和 EQ 测试。`v0.1.0-beta.4` 已通过 [GitHub Actions](https://github.com/quguai/sovel-player/actions/runs/39416673982) 验证 Android 签名 APK 构建及测试音频排除；Android 真机播放与硬件验证仍待完成。

原生 DSP 测试：

```sh
mkdir -p artifacts
clang++ -std=c++17 -O2 -Wall -Wextra native/equalizer/tests/dsp_test.cpp native/equalizer/SovelEqualizerDSP.cpp -o artifacts/eq-dsp-test
artifacts/eq-dsp-test
```

macOS 原生位置／定时／历史测试：

```sh
swiftc native/playback/ios/SovelPlaybackState.swift tests/native/main.swift -o /tmp/sovel-playback-tests
/tmp/sovel-playback-tests
```

iOS UI 测试位于 `ios/SovelUITests`。打开 `ios/Sovel.xcworkspace`，选择 **Sovel** Scheme 和可用模拟器，运行相关测试。`sh scripts/prepare-reference-fixture.sh` 为就地访问测试准备独立文件分享应用；重新生成工程后可用 `ruby scripts/add-ios-uitests.rb` 恢复测试目标，需要 `xcodeproj` gem。UI 测试进程启用 BlurView 内置测试保护，避免动画空闲等待阻塞。构建产物与截图放在忽略的 `artifacts/`。

## 实现参考与素材

[功能采用核查](../docs/feature-adoption-review.md)、[设置／扫描说明](../docs/settings-and-scan-references.md)、[元数据核查](../docs/music-metadata-review.md)和[参考仓库目录](../docs/upstream-references.md)区分上游研究、当前实现与规划，现为中文。未复制参考项目的 GPL／AGPL 实现；`music-metadata` 是实际使用的 MIT 依赖。

生成的图标、唱片贴图和缺省图片均保留相邻来源记录。真实内嵌图片优先于四张默认封面和两张中性头像。默认图片共用、不改写音频标签，也不冒充真实歌手照片；暂未提供手动挑选缺省图片或在线歌手图片服务。

项目使用根目录 [MIT 许可证](../LICENSE)，保留 [Expo 初始模板许可](LICENSE)。

## 聚合曲库与媒体服务器

进入 **设置 → 音乐来源**，搜索局域网内的 Jellyfin / Emby / DLNA，或手动输入任一支持协议的地址（Jellyfin、Emby、DLNA、SMB、WebDAV、OpenSubsonic），登录后勾选音乐库或目录。HTTP 反向代理前缀会保留。每个选中的音乐库成为可独立启停、调整优先级的来源。来源卡片一行两张，展示名称、类型、曲目数与状态；点击后查看地址、同步、聚合开关、优先级和重新连接。使用 **同步曲库**，先发现完整服务器列表，再按固定总数导入。服务器音频和标签只读。当前适配器完整分页枚举并更新元数据，不提供服务器增量变更订阅。

- 保留 `tracks`、物理歌曲 ID、收藏、歌词偏移、历史和已保存队列。结构版本 5 新增 `catalog_copies`、来源选项、版本偏好和磁盘同步暂存表；旧数据分批回填，中断后可继续。升级时不要删除 `sovel.db`。
- 专辑／歌曲／歌手／文件夹通过 SQLite 分页浏览，列表使用轻量摘要，当前歌曲再加载完整本地标签与歌词。可用时使用 FTS5 trigram 加速长子串查询；短中文和较旧 SQLite 使用字面子串回退。
- 旧缓存可能缺少新加入的发行标识／年份；执行一次本地全量扫描可补齐，已有 ID 与收藏保留。
- 优先使用录音／发行标识聚合，否则采用专辑、歌手、歌名、碟号、曲序与时长的保守规则。未知标签分别保留，Live／重制／不同发行版本不会仅凭同名合并。当前不提供手动合并／拆分。
- 在可用且支持播放的副本中，依次考虑记住的选择、无损、本地和来源优先级。没有单曲覆盖选择时，优先从同一来源播放完整专辑；不支持的 DSD 不会因为参数高而优先。
- 关闭来源保留索引、收藏与授权，从聚合浏览和后续队列候选中排除。曲库筛选标签只改变当前视图；重新启用即可显示已保存索引。
- Jellyfin/Emby Token 以及 SMB/WebDAV/OpenSubsonic 账号密码使用 `expo-secure-store`（iOS Keychain／Android 加密存储）。后三种协议重连需要的密码留在安全存储，不进入 SQLite 或设置备份。SQLite 只保存服务器／用户／音乐库身份。鉴权头交给原生播放，带鉴权的封面 URL 只存在内存。新增依赖需要原生构建；iOS 需正确签名权限，未签名模拟器包无法访问 Keychain。
- 两种适配器都请求原文件串流（`Static=true`），暂不自动调用服务器转码；原生编码／DSF 支持仍决定是否能播放。Jellyfin 服务器提供歌词 API 时按需加载，Emby 歌词尚未接入。
- 离线、失败或取消枚举不会将旧歌曲标记为缺失；取消导入回滚本来源的更新。完整同步后缺失条目仍保留，不删除收藏；发现过程中总数变化会安全失败，需重新同步。
- 六种协议共用来源启停、排序和聚合；不提供远程写入、跨服务器收藏同步、音频下载或持久化串流缓存。

在宿主机执行 `python3 tests/mock-media-server.py` 可启动**模拟服务器**，并非真实 Jellyfin / Emby 部署。可选集成测试 `SovelUITests.testMusicSourcesAndRemotePlayback` 使用此回环服务器与开发 WAV 样本，验证原生登录、同步、聚合、来源开关与播放；服务器未运行时跳过。模拟服务器和开发音频不打入 Release APK。


### 局域网发现与其他网络来源

- **自动发现：**点击搜索后发送 Jellyfin/Emby UDP 7359 探测与 DLNA SSDP 1900 M-SEARCH，限时收集并去重，离开页面即取消。选择发现结果后填入地址，再登录和勾选音乐库。保留手动输入，不扫描整个网段。需要同一可达局域网；VPN、路由器隔离、容器端口配置可能屏蔽广播。
- **iOS 权限：**允许“本地网络”访问；真机广播／组播还需要 Apple 批准 `com.apple.developer.networking.multicast`，并加入对应签名配置。模拟器通过不等于签名真机通过。发现不可用时可手动输入 HTTP(S) 地址。新增原生模块需要重建应用，Expo Go 热更新不能启用。
- **SMB：**填写 `smb://主机/Music`，支持端口和子目录，例如 `smb://主机:1445/Music/收藏`。勾选共享根目录或列出的子目录，子级递归遵循扫描规则。访客可留空账号，域账号使用 `DOMAIN\user`。iOS 库协商 SMB 2.0.2/2.1，Android 使用 SMBJ 的 SMB2/3 支持；不支持 SMB1，不承诺跨平台支持强制 SMB3 加密共享。播放器通过带随机会话令牌的回环 HTTP Range 代理按需读取原文件，不复制整首音频。同步／播放时才建连，离线 NAS 不阻塞本地曲库启动。
- **WebDAV：**填写完整 HTTP(S) 目录地址，可选 Basic 认证，账号密码独立输入。使用 PROPFIND Depth 1 逐层读取选中目录，服务器需支持 HTTP Range 才能解析标签。原生读取器在接收正文前拒绝忽略 Range 的响应，并限制单次读取大小。暂不支持 Digest、OAuth 和带认证的自动重定向。
- **文件扫描：**SMB/WebDAV 复用文件扫描里的隐藏目录、子目录、小文件过滤规则。第一步发现并统计符合条件的文件；第二步按固定总数分段解析内嵌元数据、歌词和封面，仅缓存图片。父目录与子目录互斥勾选，避免重复导入；失败／取消保留已有索引和收藏。
- **DLNA：**发现 MediaServer，或手动输入设备描述 XML 地址；通过 ContentDirectory Browse 分页读取目录、歌曲元数据和 HTTP 音频资源。采用服务器发布的数据，不改写标签，也不保证该资源未被服务器转码。本次是读取远程曲库，不包含投屏控制器、渲染器或 AirPlay。
- **OpenSubsonic：**填写服务器根地址和账号密码，勾选音乐文件夹，分页读取专辑及歌曲；请求 `format=raw` 原文件串流。使用每个会话随机生成的 salt/token，含认证的播放／封面 URL 仅存在内存。缺少专辑或文件夹 API 的服务器、只提供转码的服务器以及远程歌词 API 需另行适配。
- **数据保留：**先暂存完整清单与标签，再事务提交来源快照；复用 schema 5、本地曲库和物理歌曲 ID，不删库重建。收藏、队列与偏移保留。没有远程写入、密码导出、整首下载或持久化音频缓存。

复现命令与依赖见[英文开发说明](README.md#network-adapters-and-discovery)。本机测试包含真实 SMB2 协议认证、目录与 Range 读取；Swift 覆盖发现与代理，JVM 使用真实 SMBJ/NanoHTTPD 编译和运行，但不代表完整 Android APK 已验证。iOS UI 测试使用本地测试服务器检查发现、手动连接、勾选、同步、原生播放与来源保留。真实 NAS、带权限签名的 iOS 发现与 Android 真机仍需验证。[实现和开源许可说明](../docs/network-sources.md)。
