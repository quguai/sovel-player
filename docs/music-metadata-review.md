# music-metadata 接入核查

核对日期：2026-10-20。

## 结论与范围

Sovel 已经直接使用 `music-metadata`，无需另写一套 FLAC、WAV、DSF 标签解析器。本轮核查源码与现有接入、执行读取诊断，并整理后续改进点；没有修改生产解析逻辑，也没有升级依赖。

- 项目安装及锁定版本：`12.2.2`，`package.json` 范围为 `^12.2.2`。
- [上游仓库](https://github.com/Borewit/music-metadata)已浅克隆到 `repos/music-metadata/`，由根目录 `.gitignore` 排除。
- 参考提交：`8e61c734beb6c3000b23e81bb3e3562de6bf0368`；该提交的 `package.json` 为 `12.2.3`，不等同于本项目当前安装版本。
- 仓库代码许可：MIT，详见参考仓库 `LICENSE.txt`。未复制上游测试音频到本项目；音频样本的再分发许可需要单独核实。

## 当前接入已经做对的部分

| 位置 | 现有行为与作用 |
| --- | --- |
| `mobile/src/core/metadata.ts` | 调用 `parseFromTokenizer`，读取标题、歌手、专辑、轨号、碟号、采样率、位深、声道、时长、封面与歌词；专门区分歌手图片与专辑封面 |
| `mobile/src/core/RangeTokenizer.ts` | 提供随机位置读取，避免将整首无损音乐加载进 JS 内存；DSF 尾部的 ID3 标签可以直接定位读取 |
| `mobile/src/services/files.ts` | 从现有音频路径读取，封面单独缓存；无内嵌歌词时尝试旁边的 LRC，不默认复制音频文件 |
| `mobile/metro.config.js` | 使用库的便携 core 入口，避免将 Node 文件 API 带入 React Native |
| `duration: false` | 不主动要求额外遍历音频来计算时长；FLAC、WAV、DSF 仍可以从头部计数获得时长。此选项不保证任意格式都能只读取少量数据 |
| `finally` 关闭 tokenizer | 解析成功或失败均释放读取句柄 |

## 建议按顺序补齐的能力

### 1. 保存解析库已经提供的字段

目前适配层会丢弃 `format.container / codec / lossless / bitrate / tagTypes`，格式展示仍主要依赖文件扩展名。应保存实际容器与编码，区分同容器内的不同编码，例如 AAC 与 ALAC。

还可以保存发行日期、流派、作曲者、ISRC、MusicBrainz 标识，以及 ReplayGain 的曲目/专辑增益和峰值。ReplayGain 有比值与 dB 等表示，映射时需要明确单位；读出标签不代表播放引擎已经应用回放增益。

这些字段可先作为可选字段加入现有 SQLite `tracks.metadata` JSON，不需要清空或重建整个数据库。已有曲目需重新解析后才能补齐；可以通过全量扫描或后续的元数据版本号触发刷新。只有新增查询索引等需求才另做结构迁移。

歌词目前只使用 `common.lyrics[0]`，可以按时间戳、语言和内容选择适合展示的版本，并保留其他语言。DSF 的位深字段也应补充不同位序样本验证，避免把原始格式字段误当作 PCM 位深。

### 2. 区分解析失败与解析警告

可保留 `quality.warnings` 供诊断，不增加日常歌曲页面的信息量。不要直接复用现有 `Metadata.warning`：后者参与增量扫描的失败重试判断，将非致命警告放进去会导致文件反复解析。

本轮发现具体版本差异：`12.2.2` 对项目的合法 WAV 样本报告 `Data chunk size exceeds file size`，使用库自带的 Node `parseFile` 也能复现，因此不是 Sovel 的随机读取器独有问题。

安装版 `lib/wav/WaveParser.js` 先扣除整个 chunk 再判断剩余长度；参考提交的 `lib/wav/WaveParser.ts` 已改为先扣头部、检查 payload，再扣 payload 与奇数字节补齐。下一次升级应针对这个问题和现有夹具做回归；本轮没有运行参考版本，也没有将警告消失作为已验证结论。

### 3. 统一内存边界，并在单文件读取期间响应取消

- 当前 tokenizer 的缓冲限制是 16 MiB，库的 `maxMemoryAllocation` 默认是 64 MiB，封面缓存还存在解析后的 12 MiB 限制。应明确设置解析分配上限，并对多张图片的累计占用另设预算。这些限制不等于整个进程的内存上限。
- 当前取消主要发生在目录、文件和提交边界。应将取消检查传递到随机读取器，在解析大标签过程中也能结束；仅给底层 tokenizer 传入 AbortSignal 不足以保证自定义读取器会中断。
- 不应全局开启 `skipCovers` 或 `skipPostHeaders` 来换取表面上的扫描速度，否则可能遗漏用户已经写入文件的封面与尾部标签。

### 4. 借鉴上游的边界测试

| 上游文件 | 有价值的验证范围 |
| --- | --- |
| `test/test-file-dsf.ts`、`test/test-dsdiff.ts` | DSD 采样率、样本数、时长、标签与容器边界 |
| `test/test-file-flac.ts`、`test/test-file-wav.ts` | 不同标签块、编码及 WAV 特殊 chunk |
| `test/test-replay-gain.ts` | 曲目/专辑增益、缺失峰值、大小写和编码差异 |
| `test/test-id3v2.ts`、`test/test-id3v2.4.ts` | 普通歌词、同步歌词、语言标识 |
| `test/test-allocation-limits.ts` | 伪造长度、截断块、越界分配、Ogg 累积包、自定义 tokenizer 短读 |

优先借鉴测试用例的构造与断言，新增自己的小型合成夹具，避免把大量音频样本直接带入应用。

## 本轮验证

使用项目安装的 `12.2.2`、当前 `RangeTokenizer` 和项目夹具记录读取量：

| 输入 | 文件大小（字节） | 累计读取量（字节） | 结果 |
| --- | ---: | ---: | --- |
| `assets/sample.wav` | 4,326,816 | 93,251 | 读出 24 秒、44.1 kHz、16 bit、封面与 6 行歌词；存在上述版本警告 |
| `assets/sample.flac` | 402,769 | 108,603 | 读出时长、格式、封面与歌词，无解析警告 |
| `tests/tagged.dsf` | 101,448 | 93,289 | 读出 2.8224 MHz、双声道、尾部标签与歌词，无解析警告 |
| 虚拟大 DSF | 3,221,318,636 | 93,289 | 标签放在 3 GiB 偏移处，成功读出标题、歌手与 6 行歌词 |

读取量包含重复探测，不是去重后的区间大小。大 DSF 使用合成的随机读取器，没有创建真实的 3 GiB 音频；它验证远距离定位与尾部标签读取，不代表真机吞吐量或 DSD 播放已经验证。

诊断脚本及输出位于忽略目录 `mobile/artifacts/audit-music-metadata.ts` 和 `music-metadata-audit.jsonl`。

- `npm test`：26 项通过。
- `npm run typecheck`：通过。
- ESLint：尝试运行但项目未安装 ESLint，本轮未额外安装工具。

元数据解析、音频解码、DSD 输出和 USB 独占是不同职责；本库解决第一项，后三项仍需要播放引擎和平台层实现。
