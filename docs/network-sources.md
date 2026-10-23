# 网络曲库：实现、边界与依赖

开发源码支持 Jellyfin、Emby、DLNA、SMB、WebDAV、OpenSubsonic，共用现有来源、SQLite 聚合、收藏及版本选择；不是替换本地数据库的新应用。网站和 README 区分开发源码与已经发布的 APK。以下协议均仅开放读取接口。

## 用户流程

设置 → 音乐来源 → 添加。协议选择保留六个紧凑入口；搜索局域网后点击结果填入地址，再登录、勾选音乐库。手动输入始终保留。来源概览一行两张卡片，详情中管理同步、参与聚合与优先级。目录型来源默认只选根目录，父子目录互斥，避免重复扫描；可改为多个子目录。

先发现完整清单，再按固定总数读取标签并暂存，最后事务提交。失败或取消不会把旧曲目误标为缺失，不删除收藏。SMB/WebDAV 复用隐藏目录、小文件、递归规则；其他媒体服务器使用服务器已有的音乐目录和标签。新增协议沿用 schema 5 的来源配置与物理副本，不需要重建数据库。

## 协议与实现

| 协议 | 原理 | 当前边界 |
| --- | --- | --- |
| Jellyfin / Emby | UDP 7359 发现、HTTP API 登录、勾选音乐库、分页清单、原文件串流 | 真实部署、反向代理和 Android 设备需扩大验证 |
| DLNA | SSDP 1900 M-SEARCH、设备描述 XML、ContentDirectory SOAP Browse、DIDL-Lite 音乐元数据 | 读取 MediaServer 曲库；不是投屏／渲染器。采用服务器发布的 HTTP 资源，无法保证其未转码 |
| SMB | iOS SMBClient、Android SMBJ，读取共享目录与文件；随机令牌的本机 HTTP Range 代理衔接原生播放器 | 手动输入含共享名的地址；无 SMB1。iOS 支持 SMB 2.0.2/2.1，不承诺强制 SMB3 加密共享兼容 |
| WebDAV | PROPFIND Depth 1 遍历、Basic 认证、原生受限 HTTP Range 元数据读取 | 需要 Range，支持匿名或 Basic；未接入 Digest/OAuth，不跟随认证重定向 |
| OpenSubsonic | ping、getMusicFolders、getAlbumList2、getAlbum、stream(format=raw)、getCoverArt | 相应 API 必须可用，未单独接远程歌词 API；没有假定服务器能原样播放所有格式 |

发现是用户触发的限时 UDP 探测，去重后显示，不扫描所有地址、不自动尝试登录。iOS 声明本地网络用途与 multicast entitlement；真机分发需要 Apple 批准权限并使用匹配签名配置。手动 HTTP 地址不依赖发现成功。隔离网络、容器和 VPN 可使发现不可达。

SMB/WebDAV 标签读取复用 `music-metadata` 的随机访问解析，包括内嵌封面、艺术家图片和歌词。单次读取受限；WebDAV 在收到响应头时检查 206/Content-Range，拒绝忽略 Range 的整文件响应。仅图片进入 Artwork 缓存，不落盘整首音频。SMB 连接在同步／准备播放时建立，启动本地曲库不等待 NAS；请求有超时，失败可重试。断网自动无缝续播和持久化音频缓存不属于本次实现。

## 凭据

Jellyfin/Emby 只保存访问 Token。SMB/WebDAV/OpenSubsonic 重连需要的账号密码以系统安全存储保存（Keychain／Android 加密存储），不进入 SQLite、设置备份或日志。OpenSubsonic 用随机会话 salt 生成认证 Token。带认证的播放／图片 URL、SMB 回环代理地址只在运行期使用；数据库使用不带本机临时令牌的稳定文件身份。DLNA 资源 URL 来自服务器，应用不附加账号。配置 TLS 与访问权限由用户的服务端决定。

## 依赖与许可

| 依赖 | 使用方式 | 许可 |
| --- | --- | --- |
| [kishikawakatsumi/SMBClient](https://github.com/kishikawakatsumi/SMBClient) | iOS 直接依赖，固定 `66eafaa6d17e034e8036dee4b3ebc1b52cb53919`；本项目桥接层未复制其实现 | [MIT](licenses/SMBClient-MIT.txt) |
| [hierynomus/smbj](https://github.com/hierynomus/smbj) 0.13.0 | Android SMB 客户端 | [Apache 2.0](licenses/Apache-2.0.txt)，Copyright (C) 2016 SMBJ Contributors |
| [NanoHTTPD](https://github.com/NanoHttpd/nanohttpd) 2.3.1 | Android 回环 HTTP Range 服务 | [BSD 3-Clause](licenses/NanoHTTPD-BSD.txt) |
| fast-xml-parser 5.x | UPnP/WebDAV XML，禁用 DTD/自定义实体声明，限制文档大小 | [MIT](licenses/fast-xml-parser-MIT.txt) |
| @noble/hashes 2.x | Subsonic 协议要求的 MD5 challenge 与封面缓存标识；不用作密码存储算法 | [MIT](licenses/noble-hashes-MIT.txt) |

完整直接依赖许可随应用“设置 → 关于 → 第三方开源许可”分发。

协议资料：[Jellyfin networking](https://jellyfin.org/docs/general/post-install/networking/)、[Emby server discovery](https://dev.emby.media/doc/restapi/Locating-the-Server.html)、[OpenSubsonic API](https://opensubsonic.netlify.app/docs/)、[Apple multicast entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.networking.multicast)。

## 验证

运行方式见 [mobile/README](../mobile/README.md#network-adapters-and-discovery)。本机 Impacket 提供真实 SMB2 协议服务；HTTP/DLNA/Subsonic fixture 为模拟服务器，不能代替群晖、飞牛或真实 Jellyfin/Emby 的兼容性认证。Swift 原生测试覆盖发现、SMB2 文件和代理 Range、受限 HTTP；JVM 测试用真实 SMBJ/NanoHTTPD 验证读取与 Range。iOS UI 测试覆盖发现选址、手动连接、勾选、同步和原生播放。完整 Android 原生模块/应用构建、签名 iOS 真机发现及跨网络长期播放需要分别验证。
