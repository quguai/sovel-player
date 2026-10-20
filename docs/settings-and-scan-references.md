# 设置与扫描实现参考

核对日期：2026-10-20。参考源码克隆在项目根目录的 `repos/`（已加入 `.gitignore`），未作为依赖、子模块或源码导入本工程。

## 查阅的项目

| 项目 | 固定版本 | 查阅内容 | 用在 Sovel 的决定 |
| --- | --- | --- | --- |
| [NeriPlayer](https://github.com/cwuom/NeriPlayer) | `113699bb7b81e92b7947c43d2079096f70756f90` | `modules/model/.../local/LocalAudioImportModels.kt`、`modules/local/.../audioimport/LocalAudioImportModels.kt`、`LocalAudioScanProgressThrottleTest.kt` | 区分文件发现与元数据读取阶段；未知总数不报百分比；限制 UI 进度更新频率 |
| NeriPlayer | 同上 | `app/.../settings/component/usb/UsbExclusiveSettingsPresentation.kt`、`modules/model/.../effects/AudioEffectsModels.kt` | 用户偏好与实际音频能力分开；独占状态、系统回退和不可用状态不能混为一谈；PEQ 需要真实处理链 |
| [Auxio](https://github.com/OxygenCobalt/Auxio) | `c05cebc52fe2393bf3a988068e4060fd6dba408f` | `app/src/main/res/xml/preferences_root.xml`、`music/service/IndexingHolder.kt` | 来源管理与索引动作分开；常用设置直接可达；后台扫描需要生命周期与系统服务支持 |
| Auxio | 同上 | `playback/replaygain/ReplayGainAudioProcessor.kt` | ReplayGain 应处理音频流并区分曲目/专辑策略，不能只保存一个开关或简单改播放器音量来声称已实现 |

两份克隆的 LICENSE 均为 GPL v3 文本。本次参考行为、分层及交互，Sovel 改动为自行实现，未拷入这两个项目的源代码。若后续直接集成其原生模块，需先明确应用的分发与许可方案。

## 本轮实现

1. 先授权文件或文件夹，不自动播放、不自动开始扫描。
2. 保存过滤小文件（KB）、忽略隐藏文件/目录、包含子目录规则。每次任务启动时冻结规则，过程中不可修改。
3. 第一阶段完整遍历所有来源，发现数量逐步增加；没有进度百分比。先完成过滤，再确定第二阶段总数。
4. 第二阶段按固定总数读取标签、更新 SQLite。跨来源进度累计，不会回零。进度中的“已处理”包括增量扫描命中的未变化文件及标签读取失败的文件，失败数单独展示。
5. 增量复用可靠且无警告的大小/修改时间相同项；全量重新读取全部符合规则的文件，包括封面和歌词。两者都复用 `sovel.db` 和稳定曲目 ID，保留收藏。
6. 完整枚举成功后才允许标记真正缺失的曲目。规则排除的旧曲目保持原样；暂时离线、目录权限失败不删除原有索引。
7. 发现阶段取消没有入库变更；导入按来源事务提交，取消时当前来源不提交，先前已完成的来源保留更新。封面缓存独立于曲库事务，可能已经写入；音频不复制。
8. 设置首页分为曲库/外观、常用设置、播放/系统。定时、后台播放直接可用；后续十段均衡器已接入原生处理并完成 iOS 模拟器验证，见 [移动端说明](../mobile/README.zh-CN.md#十段均衡器)；PEQ 仍不可用。高级设置说明当前音频能力。

网页预览仅索引浏览器当前会话所选文件；没有持久授权或完整内嵌标签解析，也不能凭未再次选择的文件推断文件已删除。真正的目录授权、元数据读取和 SQLite 索引运行在移动端。

## 当前能力边界

| 功能 | 当前版本 |
| --- | --- |
| 本地扫描、标签/封面/歌词读取 | 已实现，支持读取 FLAC、WAV、DSF 等标签；读取与播放支持分开 |
| 样式管理 | 已有主页布局、封面/唱片/沉浸、唱片材质、唱臂、颜色、灯光和转速；任意自定义主题编辑器尚未实现 |
| 后台播放 | 已接入系统音频模式与锁屏控件 |
| 定时停止播放 | 已迁移为 iOS / Android 原生单调时钟定时，iOS 模拟器后台到期暂停验证通过；Android 设备行为仍待验证 |
| 耳机拔出暂停 | expo-audio 原生实现启用；当前公开 API 没有暴露关闭选项 |
| 十段 EQ | 已接入原生处理，iOS 模拟器验证通过；Android 适配尚未完成构建与设备验证 |
| PEQ / ReplayGain | 未接入音频处理链，开关不允许伪启用 |
| 歌曲过渡 | 普通队列切歌；不承诺淡入淡出或严格无缝 |
| DSD | DSF / DFF 索引；专用解码、DoP 与 Native DSD 未实现 |
| USB | 使用系统输出；Android 独占后端、原采样率验证未实现 |
| 语言 | 简体中文；完整 i18n 尚未接入 |

## 核对的平台接口

- [Expo SDK 58 Audio](https://docs.expo.dev/versions/v58.0.0/sdk/audio/)：与安装版本相符；耳机/Bluetooth 断开行为由模块实现。
- [Expo SDK 58 FileSystem](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/)：目录遍历与随机读取。
- [Android USB Host](https://developer.android.com/develop/connectivity/usb/host)：设备枚举/权限/端点接口，不等于自动获得 USB Audio 独占输出。

后续优先选择可独立集成、许可与目标平台合适的原生音频模块。开源实现也须通过目标播放器、DAC 与音频样本的实际验证，不能仅凭项目功能列表认定正确性。

## 本轮验证结果

- TypeScript 检查通过，26 项测试通过，覆盖真实 WAV / FLAC / DSF 标签读取、过滤边界、收藏与 ID 保留、取消/离线保护、先扫描所有来源再导入，以及固定总数下进度不倒退。
- iPhone SE 4.7 英寸模拟器 `testSettingsScanRulesAndCapabilities` 通过，检查设置入口、未接入音效的禁用状态、定时、规则重启记忆、全量/增量扫描和 USB 说明。结果：`mobile/artifacts/ui-settings-scan-2.xcresult`。
- 网页 375×667、320×568、667×375 检查通过：选择后不立即导入、过滤计数、两种扫描结果、定时、偏好记忆、无横向溢出。
- 已尝试 lint，但工程未安装 ESLint；未将这一项报告为通过，也未为本轮变更自动安装依赖。
- 原生横屏未在本轮验证，既有旋转问题不属于本轮修复范围。尚未在 Android 真机或 USB DAC 上验证底层输出能力。

## 补充参考：MusicFree

MusicFree 已克隆至 `repos/MusicFree`。已核对本地文件遍历与批量元数据读取、RN 播放事件服务、设置分类、主题和配置存储。版本及具体借鉴点见 [参考仓库目录](upstream-references.md)。本次仅整理参考源码与记录，未替换现有播放引擎或数据库。
