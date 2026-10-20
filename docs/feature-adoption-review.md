# 参考项目的功能采用清单

核对日期：2026-10-20。以下依据 `repos/` 中的固定提交及 Sovel 当前源码，侧重功能、状态管理和音频行为。上游版本见 [参考仓库目录](upstream-references.md)。本轮为源码评估，没有安装上游依赖、运行上游测试或修改播放器功能。

后续落地更新（同日）：已按本清单接入十段 EQ、六种自有预设、自定义保存/恢复/删除、前级余量与生效状态。iOS 模拟器验证通过；Android 已写入原生适配但构建/设备验证未完成。PEQ、AutoEQ、路由独立记忆仍属规划；本地设置与 EQ 预设 JSON 备份已接入，详见 [移动端实现与验证](../mobile/README.zh-CN.md#十段均衡器)。新增队列 / 位置恢复、单曲歌词偏移、设置 / 预设备份和原生倒计时详见移动端说明。下文表格是上游能力与采用建议，不代表 Sovel 已全部实现。

## 总体选择

| 项目 | 最适合采用的部分 | 在 Sovel 中的位置 |
| --- | --- | --- |
| NeriPlayer | 音效配置、EQ/PEQ、预设、输出状态、定时模式、设置分类 | 音频功能与设置行为的主要参考 |
| MusicFree | RN 设置组织、主题配置、歌词偏移、队列/进度恢复、媒体控制事件、备份 | TS 交互与状态管理的主要参考 |
| Auxio | 本地曲库、自动索引、播放状态恢复、ReplayGain 策略 | 本地播放器可靠性与数据处理参考 |
| music-metadata | 多格式标签、封面、歌词、ReplayGain 标签读取 | 已经直接使用，继续完善适配层 |

保留 Sovel 已确定的黑金曲库、独立歌词/详情页与唱片外观。功能可以借鉴，页面组织按小屏设备重新设计。

## NeriPlayer：确认值得采用的能力

### 设置组织

`SettingsPage.kt` 将播放、音效、USB、主题、歌词、存储、备份等按职责分组；`AutoSettingsSchema.kt` 为设置集中登记默认值、类型、顺序、入口和有副作用的专用保存逻辑。

Sovel 可以采用一个轻量 TS 设置定义表：标题、摘要、当前值、平台可用性、跳转目标。保留已有 SQLite 偏好存储，不必引入其 Kotlin KSP 生成体系。普通开关直接保存，音频切换和目录授权通过业务方法执行。

建议设置首页保持这些直接入口：文件扫描、样式管理、均衡器、PEQ、定时停止、播放设置、USB 输出、语言、备份与恢复、关于。均衡器和 PEQ 是同一音效引擎的两个编辑入口；首页显示“关闭 / 预设名称 / 当前未生效”，细节通常只进入一级。

### 均衡器、PEQ 与预设

源码已经包含真实配置和处理链，不只是页面：

| 能力 | 上游实际实现 | 建议用于 Sovel |
| --- | --- | --- |
| 图形 EQ | 10 个中心频率，约 31 Hz–16 kHz；各频段增益及前级增益 | 提供十段、曲线、恢复平直、自定义保存；小屏优先曲线与单频段精调 |
| PEQ | 最多 10 段；频率、增益、Q、单段开关；峰值、搁架、通带等类型 | 独立参数列表；先覆盖常用峰值/低架/高架，其余根据引擎能力开放 |
| 内置预设 | 29 个，按风格、音色、场景、设备分组 | 首批提供少量常用预设，例如平直、人声、流行、摇滚、古典、低频增强；参数另行设计与验证 |
| 自定义预设 | 保存、同名/同 ID 替换、删除、JSON 分享导入、数量与名称限制 | 保存/另存为/重命名/删除/导入导出，使用带版本号的格式并展示导入预览 |
| 耳机校正保留 | 切换内置风格保留 PEQ；恢复自定义预设则恢复完整音色 | 将“听感风格”和“耳机校正”分开，明确切换与导入覆盖范围 |
| 输出配置 | `speaker / wired / bluetooth / usb / other` 五类路由分别记忆 | 先按输出类型记忆；本次代码证据不等于按每副耳机型号或每台 DAC 自动识别 |
| AutoEQ 导入 | 解析 ParametricEQ / Equalizer APO 文本和 GraphicEQ；含 preamp | 导入耳机校正，报告不支持/超限滤波器；GraphicEQ 映射到十段是近似，不宣称原曲线无损还原 |
| 生效状态 | 区分关闭、中性、不支持格式、原生模块不可用、USB 路径旁路 | 保存偏好与当前有效状态分开显示，避免开关亮了却无声音变化 |
| 参数处理 | 数值有限性/上下限校验、参数平滑、前级余量、限幅 | 合并 EQ/PEQ 增益时考虑削波；切换时做平滑，关闭后回到原始处理路径 |

注意：NeriPlayer 的部分预设还包含混响、压缩、空间处理、人声增强等参数。只做十段 EQ 时不能直接搬用全部预设数值并声称效果一致。模拟环绕、卡拉 OK、扬声器增强可暂缓，优先完成 EQ、PEQ 和可靠播放。

### 定时与 USB

`SleepTimerManager.kt` 支持倒计时、倒计时到点后播完本首、播完本首、播完列表；倒计时使用单调时钟截止时间。Sovel 可采用这些模式，并将到期停止放入原生播放生命周期，解决目前依赖 JS 回调的限制。必须定义单曲循环、随机播放、手动切歌时“本首/列表结束”的含义。

USB 已有权限、连接、PCM 写入、硬件/软件音量、格式协商、缓冲、后台恢复和回退状态的代码。值得参考的是完整状态流与恢复策略，仍需在 Sovel 的 Android 原生层和真实 DAC 上验证。

USB 独占与 bit-perfect 是两个维度：独占通道可以运行 DSP，但 EQ、PEQ、ReplayGain 等改变采样值时不能同时标记 bit-perfect。建议默认直通旁路音效，保留用户预设；用户选择音效处理后显示实际处理状态。当前检查的 PCM 独占链路不能作为已支持 DoP / Native DSD 的证据。

## MusicFree 与 Auxio 的补充

| 功能 | 参考证据 | Sovel 的采用方式 |
| --- | --- | --- |
| 播放状态恢复 | MusicFree `PersistStatus` 保存队列、当前曲、进度、循环、倍速；Auxio 恢复时修正曲库变化后的队列位置 | 已补齐稳定曲目 ID、队列、进度、顺序恢复和原生位置记录。重启默认暂停，不自动出声；离线来源保留索引并提示 |
| 歌词手动偏移 | MusicFree 按曲目保存 `lyricOffset`，支持提前/延后/重置 | 在歌词设置提供单曲微调，数据库覆盖值与原始 LRC 标签分开；重新扫描后保留用户调整 |
| 中断与媒体按钮 | MusicFree 服务处理 RemotePlay/Pause/Seek/Duck，记录中断前状态 | 补齐中断恢复策略及回归测试；当前已有锁屏控件，不重复实现一个竞争的控制入口 |
| 外观与主题 | MusicFree 将模式与背景配置分开 | 在已有唱片/唱臂/配色基础上增加命名的外观组合；导入时校验资源，避免恢复不存在的本地文件路径 |
| 自动索引 | Auxio 通过文件系统变更请求带缓存的后台索引 | 手动两阶段扫描已经具备；后续对 Android 本地来源做变化合并、去抖、后台任务，避免每次变化全量重扫 |
| ReplayGain | Auxio 提供关闭/曲目/专辑/动态模式，缺少某类增益时回退，区分有无标签的前级增益 | 先用 music-metadata 保存增益/峰值，再由原生处理链应用；专辑播放优先保持专辑内相对响度 |
| 系统均衡器 | Auxio 携带 audio session ID 打开外部音效面板 | 可作为 Android 的辅助入口；不是 Auxio 自带十段 EQ，也不能保证各设备一致或支持 USB 独占 |
| 备份与恢复 | MusicFree 的本地/WebDAV 备份；NeriPlayer 的版本化设置、同步载荷 | 先做主题、预设、扫描规则、收藏和歌单的本地备份；跨设备文件权限与路径需重新关联，凭据不混入普通分享文件 |

Auxio 查阅版本的 `ReplayGainAudioProcessor` 明确只接受 16-bit PCM。采用它的曲目/专辑选择策略，不将这份实现直接当作 24/32-bit 或 DSD 高解析处理链。

MusicFree 的本轮源码搜索未发现与 NeriPlayer 对应的内置 EQ/PEQ 引擎。它和 NeriPlayer 查到的 WebDAV 用途主要为备份/同步，不能直接等同于 NAS 远程音频枚举与播放。SMB、WebDAV 曲库、DLNA 浏览、Subsonic 等仍按独立来源适配器逐项验证。

## 与当前 React Native 工程如何衔接

RN + TS 的选择继续适用：页面、预设模型、过滤规则、导入校验和 SQLite 存储由 TS 负责；实时音频处理放在原生线程，JS 发送参数和接收状态，不逐帧传输 PCM。

本地安装的 `expo-audio ~58.0.9` 使用 Android ExoPlayer、iOS AVPlayer/播放队列，当前公开 API 未提供 Sovel 所需的 EQ/PEQ 处理链注入。官方也将更高级的实时效果指向其他音频图能力：[Expo SDK 58 Audio](https://docs.expo.dev/versions/v58.0.0/sdk/audio/)。这不是换一个设置组件就能完成的功能。

建议下一步做独立的原生音效验证：Android 在播放器音频链路接入 DSP，iOS 验证可承载同类处理的音频图或引擎。iOS 的 [AVAudioUnitEQ](https://developer.apple.com/documentation/avfaudio/avaudiouniteq) 可作为评估对象，但不能当成当前 AVPlayer 的即插即用插件。确认后台、锁屏、队列、seek、格式支持和内存不退化后，再确定扩展现有后端还是替换；本轮未选择或安装新引擎。

预设格式应独立于平台：版本、ID、名称、来源、前级增益、EQ 频段、PEQ 滤波器、适用输出类型。限制由后端能力报告，不能为了让一个平台“导入成功”静默丢弃滤波器。Android 与 iOS 各自验证频响，不能假定相同参数就必然完全相同。

## 推荐落地顺序及完成标准

| 阶段 | 内容 | 验收标准 |
| --- | --- | --- |
| 1：完善现有播放器 | 设置摘要、歌词偏移、队列/进度恢复、外观组合、本地设置备份；补存标签与解析警告 | 重启保留；重新扫描不覆盖用户偏好；离线文件处理正确；小屏设置无需多层跳转 |
| 2：真实音效闭环 | 原生 EQ/PEQ 验证、十段 EQ、少量内置与自定义预设、前级余量、输出类型记忆 | 扫频/测试信号验证频响；旁路与参数变化正确；后台及锁屏不失效；未接入平台明确显示不可用 |
| 3：高级音频 | AutoEQ、ReplayGain、原生定时模式、无缝播放/过渡的专项验证 | 超限/错误导入有反馈；增益单位与峰值正确；切歌、循环、暂停、来电等边界通过真机检查 |
| 4：平台与来源扩展 | Android USB 独占、DSD 输出、远程曲库适配 | 真实 HiFi 播放器与 DAC 验证输出；区分源格式和实际输出；远程断线/取消/凭据/Range 行为可恢复 |

音效功能以阶段 2 的声音验证为完成点，预设管理界面完成不代表 DSP 已接通。以上是采用建议，未在本轮新增这些功能。

## 可定位的源码与测试

下列路径相对各仓库根目录；NeriPlayer 的长包名前缀按模块分别列出。

- NeriPlayer `modules/model/src/main/java/moe/ouom/neriplayer/data/model/playback/effects/`：`AudioEffectsModels.kt`、`AudioEffectsPresets.kt`、`AudioEffectsCodec.kt`、`AudioEffectsNormalization.kt`、`AutoEqImport.kt`。
- NeriPlayer `app/src/main/java/moe/ouom/neriplayer/ui/screen/tab/settings/`：`page/SettingsPage.kt`、`audio/AudioEffectsSettingsPage.kt`、`component/usb/UsbExclusiveSettingsPresentation.kt`。
- NeriPlayer `modules/local/src/main/java/moe/ouom/neriplayer/data/settings/AutoSettingsSchema.kt`。
- NeriPlayer `modules/playback/runtime/src/main/java/moe/ouom/neriplayer/core/player/`：`audio/effects/AudioEffectsAudioSink.kt`、`audio/effects/AudioEffectsNativeBridge.kt`、`timer/SleepTimerManager.kt`、`usb/transport/UsbExclusiveNativeBridge.kt`。
- NeriPlayer `modules/native/src/main/cpp/dsp/` 及 `usb/`；`tests/dsp/neri_dsp_engine_test.cpp` 列出 23 项测试，包括旁路、频段增益、参数平滑、限幅、整数格式、异常参数等。本轮仅阅读，未运行。
- NeriPlayer `modules/model/src/test/java/moe/ouom/neriplayer/data/model/playback/effects/AudioEffectsSettingsTest.kt`：参数归一化、预设唯一性、耳机校正保留、导入导出；同模块的 `AudioEffectsDspResolutionTest.kt` 可继续用于处理链决策评估。
- MusicFree `src/pages/setting/settingTypes/`、`src/utils/persistStatus.ts`、`src/core/trackPlayer/index.ts`、`src/service/index.ts`、`src/core/lyricManager.ts`、`src/components/panels/types/setLyricOffset.tsx`、`src/utils/scheduleClose.ts`。
- Auxio `app/src/main/java/org/oxycblt/auxio/`：`music/service/IndexingHolder.kt`、`playback/state/PlaybackStateManager.kt`、`playback/replaygain/ReplayGainAudioProcessor.kt`、`playback/PlaybackPanelFragment.kt`；设置条目在 `app/src/main/res/xml/preferences_*.xml`。
- music-metadata 详见 [已有接入核查](music-metadata-review.md)。

NeriPlayer / Auxio 的许可文件为 GPL v3，MusicFree 为 AGPL v3，music-metadata 为 MIT。当前采用行为与设计参考；如直接引入原生实现、预设数据或其他源码，应逐项保留归属并核对相应分发要求。上游有测试和实现是参考依据，不等于已通过 Sovel 的跨平台与硬件验证。

## 曲库首页与本地精选（2026-10-20）

本轮首页采用一排紧凑横滑卡片，下方共用专辑 / 歌曲 / 艺术家 / 文件夹分组；保留原有底部播放条和三个导航入口。4.7 英寸竖屏卡片约 96 pt，常规屏 108 pt，横屏 80 pt；卡片露出下一张、手动滑动，分类切换保留横向位置。专辑沿用层叠封面和曲目数角标，艺术家沿用独立头像 / 缺省占位。新增代码不依赖上游运行时，也未复制上游源码。

参考点：
- MusicFree `src/pages/home/components/homeBody/operations.tsx`：首页入口与本地曲库浏览分开，入口直接到对应功能。
- NeriPlayer `ui/screen/tab/home/HomeContinueSection.kt`：续听卡片、尺寸上限、分页位置恢复、封面候选与空状态处理。Sovel 使用连续横滑而非照搬它的分页实现。
- [Apple Music 收藏](https://support.apple.com/en-ph/111118)：收藏既是快速入口，也可影响推荐；Sovel 保留可解释的本地收藏规则。
- [Spotify Mixes](https://support.spotify.com/pw/article/spotify-mixes/)：按用途组织精选入口；Sovel 的每日精选仅来自用户本地曲库，并非 Spotify 的学习模型或在线曲库。

当前能力：每日精选从可播放文件中生成当天固定顺序，最多 30 首、不补假歌曲；同日不因数据库顺序改变而变化。猜你喜欢仅依据现有歌手、同一歌手的专辑及收藏，排除当前曲目、未知艺术家误匹配和不可播放文件；没有命中时展示空态。点击精选会固定这次浏览的曲目集合，进入播放后按此集合建立队列。继续聆听复用当前播放进度。后续已新增文件曲风标签和本地听歌历史加权，见下文；在线推荐尚未接入。


### 本地收听证据接入

新增 `listening_history` SQLite 表与 iOS / Android 原生播放快照。按实际播放时间、去重覆盖区间、主动切歌和拖动行为记录，不用播放进度直接代替完成率。参考项目已有的持久化、原生生命周期思路；本次采样 / 区间合并 / revision 确认逻辑独立实现，没有将任何参考项目声明为现成推荐算法来源。曲风来自已接入的 music-metadata `common.genre`。

猜你喜欢使用最近 90 天的本地收听证据与现有收藏、歌手、专辑关系；每日精选保持当天固定抽样。完整历史不因 90 天推荐窗口而删除，用户可在「设置 → 听歌记录与偏好」分页查看。没有在线推荐、音频内容分析或云端历史上传。
