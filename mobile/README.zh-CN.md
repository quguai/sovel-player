# Sovel HiFi · Mobile

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
| SQLite 文件 | `sovel.db`，结构版本 4 |

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
- 移动／改名目前按新路径处理，旧记录保留为缺失。重叠来源可能重复建立索引，但不会复制音频。
- 存储离线、权限撤销或文件删除时保留索引和收藏。重新连接后扫描；权限失效时重新选择来源。
- **复制音乐到应用** 是单独的可选动作。iOS 可从「文件 → Sovel HiFi → Music」访问。
- 云盘文件提供方可能自行下载或缓存文件；本版面向可随机读取的本地文件，不自动镜像远程曲库。

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

PEQ、AutoEQ 导入、ReplayGain 及按输出／设备记忆预设尚未实现。NeriPlayer 用于预设和生效状态的行为参考，未复制其实现或完整音效预设。

## 收听历史与本地精选

SQLite `listening_history` 保存真实收听时长、去重音频覆盖、拖动次数与结束原因。原生单调时钟采样排除暂停和缓冲，拖动时调整采样锚点。重复播放同一区间增加时长，不重复累计完成率；未知总时长保持未知。

原生约每五秒、暂停和切歌时保存快照，JS 分批入库后确认 revision，避免重复累计。异常退出可能丢失最近一个未保存间隔。历史重扫保留，可从「设置 → 听歌记录与偏好」分页查看，应用不上传这些记录。

每日精选按本地日期保持固定，最多 30 首可播放歌曲。猜你喜欢综合标签、歌手／专辑关系、收藏及近 90 天收听证据，近 30 天权重更高。这是本地规则排序，不是在线推荐或音频内容识别；完整历史不会因排序窗口而删除。

## 格式与输出边界

WAV／FLAC 的标签与 iOS 播放已用样本验证，DSF 的 ID3、封面和歌词解析有测试。MP3、AAC、ALAC、AIFF、Ogg、Opus 等仍受平台／编码限制。DSF／DFF／APE／WavPack 可以索引，但在扩展解码接入前不开放播放。未集成 TagLib 或 FFmpeg 播放后端。

远程曲库、USB 独占、DoP／原生 DSD、内置 DAC 厂商适配、bit-perfect 检测、严格无缝播放、淡入淡出、任意自定义主题及更多应用语言尚未实现。USB DAC 当前走系统音频，长时间后台、中断、蓝牙和物理输出仍需真机验证。

## 验证

```sh
npm run check
npm run lint
```

当前基线为 54 项核心测试及 TypeScript 检查通过，ESLint 无错误、保留 7 条现有警告。使用真实 SQLite 与 WAV／FLAC／DSF 标签样本，覆盖扫描、取消／离线、来源身份、结构升级、历史、队列恢复、备份、歌词偏移、精选和缺省素材。

可选的 JS 资源导出检查：

```sh
npx expo export --platform ios --platform android --output-dir artifacts/bundles
```

资源导出不代表 Android 原生编译或设备播放通过。现有 iOS 模拟器检查覆盖导入、真实进度、WAV／FLAC 切换、歌词、扫描、重启恢复、EQ／预设、原生定时、备份流程与曲库视图；改名回归通过本地播放／重启和 EQ 测试。Android SDK／构建与硬件验证仍待完成。

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
