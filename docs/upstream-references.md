# 本地参考仓库

核对日期：2026-10-20。源码统一保存在项目根目录 `repos/`，目录整体由 `.gitignore` 排除。参考仓库保留各自的 Git 信息，可以单独查看差异与更新；这些克隆目录不作为依赖路径或子模块提交。`music-metadata` 另通过 npm 安装，是本工程已使用的解析依赖。

| 本地目录 | 上游 | 已核对提交 | 许可文件 |
| --- | --- | --- | --- |
| `repos/MusicFree` | [maotoumao/MusicFree](https://github.com/maotoumao/MusicFree) | `d118b18b3d0c904400f7eea7bf99c0ceec6c1aee` | AGPL v3 |
| `repos/NeriPlayer` | [cwuom/NeriPlayer](https://github.com/cwuom/NeriPlayer) | `113699bb7b81e92b7947c43d2079096f70756f90` | GPL v3 |
| `repos/Auxio` | [OxygenCobalt/Auxio](https://github.com/OxygenCobalt/Auxio) | `c05cebc52fe2393bf3a988068e4060fd6dba408f` | GPL v3 |
| `repos/music-metadata` | [Borewit/music-metadata](https://github.com/Borewit/music-metadata) | `8e61c734beb6c3000b23e81bb3e3562de6bf0368` | MIT |

NeriPlayer 与 Auxio 从之前的临时参考目录迁移而来，提交未变化。MusicFree 与 music-metadata 为浅克隆，后续需要历史时再获取。本次没有安装或执行参考项目的依赖、构建或生命周期脚本。

跨项目的设置、EQ/PEQ、预设、播放恢复与平台能力评估见 [功能采用清单](feature-adoption-review.md)，包含建议顺序、现有实现差距和源码定位。

## music-metadata

Sovel 当前安装版本为 `12.2.2`，参考提交的版本号为 `12.2.3`。已对照随机读取、DSF 尾部标签、封面、歌词、内存限制与解析警告；详见 [music-metadata 接入核查](music-metadata-review.md)。本轮没有升级依赖。

## MusicFree 的具体借鉴点

以下均基于表中的固定提交。`package.json` 为 MusicFree 0.6.2，使用 TypeScript、React Native 0.76.5、Expo 52、react-native-track-player 4.1.1；与本项目 RN 0.88 / Expo 58 存在版本差异。

| 参考源码（相对 `repos/MusicFree/`） | 查到的实现 | 对 Sovel 的用途 |
| --- | --- | --- |
| `src/core/localMusicSheet.ts` | 先 `getMusicStats` 遍历得到列表，再 `importLocal` 按 25 个一组调用原生元数据读取；用令牌取消 | 支持“先发现、后读取”的分层。Sovel 继续使用已实现的跨来源固定总数进度与事务提交；未来原生批量标签桥接可参考分批思想 |
| `src/pages/localMusic/mainPage/index.tsx` | 目录选择与导入调用分开，LoadingDialog 处理成功与取消 | 可参考任务生命周期；该界面不能直接作为 Sovel 两阶段百分比进度已实现的证据 |
| `src/service/index.ts` | 独立服务承接系统播放/暂停、上下曲、跳转与音频焦点事件 | 后续完善原生后台行为时参考事件归属，不在本轮直接替换播放引擎 |
| `src/pages/setting/settingTypes/index.ts`、`themeSetting/` | 设置分类映射；主题模式和背景分开管理 | 参考设置扩展方式、主题字段拆分与预览配置 |
| `src/core/appConfig.ts`、`src/utils/storage.ts` | 配置使用 MMKV 并迁移旧字段；通用存储包装 AsyncStorage，本地歌单以对象数组保存 | 借鉴偏好迁移机制；Sovel 继续使用 SQLite 曲库，不把大曲库换成整数组存储 |
| `src/core/i18n/` | 独立语言资源与翻译入口 | 后续真正接入语言选择时参考资源组织 |
| `src/pages/setting/settingTypes/backupSetting.tsx` | WebDAV 用于备份/恢复；插件运行环境也提供 WebDAV 依赖 | 可借鉴备份配置与连接流程，不能据此声称已具备完整远程曲库扫描与播放 |

### 不直接照搬的行为

- MusicFree 的目录遍历会将部分读取失败当作空目录；本地歌单初始化会过滤不可访问文件。Sovel 面向 SD 卡、外接设备和未来远程来源，继续保留离线索引及收藏，区分不可访问和真正删除。
- MusicFree 的这份本地扫描代码没有提供 Sovel 当前的大小/修改时间增量更新与 SQLite 事务边界；保留本工程已有实现及对应测试。
- README 当前声明主要支持 Android / HarmonyOS。仓库存在 `ios/` 不代表其全部能力已经完成 iOS 适配。
- LICENSE 为 AGPL v3，README 另有作者使用说明。本轮仅阅读和记录；直接移植代码或分发派生版本前，需要逐项核对相应条款及模块兼容性。

NeriPlayer 与 Auxio 的分析见 [设置与扫描实现参考](settings-and-scan-references.md)。


## 网络曲库依赖

SMBClient（iOS，MIT）、SMBJ（Android，Apache 2.0）与 NanoHTTPD（BSD 3-Clause）作为实际依赖接入。局域网发现和媒体服务协议由本项目适配层实现；WebDAV 与 Subsonic 的用途为读取曲库，不混同于参考播放器的设置备份。详细版本、许可及验证边界见[网络曲库说明](network-sources.md)。

## 参数音效与 iOS DSF

- [W3C Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/)：峰值、低架、高架双二阶滤波公式；Sovel 自行实现参数约束、叠加余量和实时过渡。
- [AutoEq](https://github.com/jaakkopasanen/AutoEq)：参考 Equalizer APO 参数文本格式，不打包测量库或自动下载预设。
- iOS DSF 复用已列明许可的 dsd2pcm 与现有 Sovel DSD FIR，新增原生虚拟 CAF 资源加载；不是移植 NeriPlayer 的播放器。
- DLNA 仅作为远程音乐目录读取，本项目当前不计划加入投屏。
