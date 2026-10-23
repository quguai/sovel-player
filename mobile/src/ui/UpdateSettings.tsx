import { themeStyles } from "./themeStyles";
import {
  ActivityIndicator,
  Pressable,
  Platform,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  canInstallUpdates,
  installedApp,
  useUpdates,
} from "../services/appUpdates";
import { Button } from "./components";
import { palette as p } from "./visuals";
import { formatDownloadSpeed } from "../core/appUpdates";

const bytes = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
export function UpdateSettings() {
  const u = useUpdates();
  const packageLabel = {
    universal: "通用包",
    "arm64-v8a": "ARM64",
    "armeabi-v7a": "ARM32",
    x86_64: "x86_64",
  }[u.packageInfo?.abi ?? "universal"];
  const busy =
    u.checking ||
    u.installing ||
    ["downloading", "verifying"].includes(u.download.phase);
  const progress =
    u.download.total > 0
      ? Math.min(1, u.download.received / u.download.total)
      : 0;
  return (
    <View style={s.page}>
      <LinearGradient colors={["#d4b17819", "#d4b17803"]} style={s.hero}>
        <View style={s.heroTop}>
          <Text style={s.eyebrow}>SOVEL / UPDATES</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>
              {u.prefs.channel === "stable" ? "稳定版" : "测试版"}
            </Text>
          </View>
        </View>
        <Text style={s.brand}>Sovel HiFi</Text>
        <Text style={s.version}>当前版本 {installedApp.version}</Text>
      </LinearGradient>
      {canInstallUpdates ? (
        <>
          <Button disabled={!u.loaded || busy} onPress={() => void u.check()}>
            {u.checking ? "正在检查…" : "检查新版本"}
          </Button>
          {u.release && u.packageInfo && (
            <View style={s.release} accessibilityLabel="可用更新">
              <View style={s.heroTop}>
                <Text style={s.releaseTitle}>{u.release.version}</Text>
                <Text style={s.small}>
                  {packageLabel} · {bytes(u.packageInfo.size)}
                </Text>
              </View>
              {["downloading", "verifying"].includes(u.download.phase) ? (
                <>
                  <View style={s.heroTop}>
                    <Text style={[s.small, s.downloadMetrics]}>
                      {u.download.phase === "verifying"
                        ? "正在校验更新…"
                        : `${bytes(u.download.received)} / ${bytes(u.download.total)} · ${formatDownloadSpeed(u.downloadSpeed)}`}
                    </Text>
                    <Text style={s.percent}>{Math.round(progress * 100)}%</Text>
                  </View>
                  <View
                    accessibilityRole="progressbar"
                    accessibilityLabel="安装包下载进度"
                    accessibilityValue={{
                      min: 0,
                      max: 100,
                      now: Math.round(progress * 100),
                    }}
                    style={s.track}
                  >
                    <View style={[s.fill, { width: `${progress * 100}%` }]} />
                  </View>
                  <Button
                    secondary
                    disabled={u.download.phase === "verifying"}
                    onPress={u.cancel}
                  >
                    取消下载
                  </Button>
                </>
              ) : u.download.phase === "ready" ? (
                <Button
                  disabled={u.installing}
                  onPress={() => void u.install()}
                >
                  {u.installing ? "正在准备安装…" : "安装更新"}
                </Button>
              ) : (
                <>
                  <Button
                    disabled={u.checking}
                    onPress={() => void u.startDownload(u.packageInfo!)}
                  >
                    下载更新
                  </Button>
                  <Button
                    secondary
                    disabled={u.checking}
                    onPress={() =>
                      void u.preferences({ ignoredTag: u.release!.tag })
                    }
                  >
                    {u.prefs.ignoredTag === u.release.tag
                      ? "已忽略自动提醒"
                      : "忽略此版本"}
                  </Button>
                </>
              )}
            </View>
          )}
          {!!u.message && (
            <View style={s.feedback} accessibilityLiveRegion="polite">
              {u.checking && <ActivityIndicator size="small" color={p.gold} />}
              <Text style={[s.message, u.hasError && { color: "#edaa95" }]}>
                {u.message}
              </Text>
            </View>
          )}
          <Text style={s.section}>更新偏好</Text>
          <View style={s.card}>
            <View style={s.row}>
              <View style={s.rowText}>
                <Text style={s.title}>自动检查更新</Text>
                <Text style={s.small}>打开应用时检查，每 12 小时最多一次</Text>
              </View>
              <Switch
                accessibilityLabel="自动检查更新"
                disabled={!u.loaded}
                value={u.prefs.autoCheck}
                onValueChange={(autoCheck) => void u.preferences({ autoCheck })}
                trackColor={{ true: p.gold, false: "#404248" }}
                thumbColor={p.text}
              />
            </View>
            <View style={[s.row, { borderBottomWidth: 0 }]}>
              <View style={s.rowText}>
                <Text style={s.title}>Wi-Fi 自动下载</Text>
                <Text style={s.small}>安装前仍由你确认；有线网络同样可用</Text>
              </View>
              <Switch
                accessibilityLabel="Wi-Fi 自动下载安装包"
                disabled={!u.loaded}
                value={u.prefs.wifiDownload}
                onValueChange={(wifiDownload) =>
                  void u.preferences({ wifiDownload })
                }
                trackColor={{ true: p.gold, false: "#404248" }}
                thumbColor={p.text}
              />
            </View>
          </View>
          <View style={s.channel}>
            {(
              [
                ["stable", "稳定版"],
                ["preview", "测试版"],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: u.prefs.channel === key,
                  disabled: busy,
                }}
                disabled={!u.loaded || busy}
                onPress={() => void u.changeChannel(key)}
                style={[s.option, u.prefs.channel === key && s.selected]}
              >
                <Text
                  style={[
                    s.optionText,
                    u.prefs.channel === key && { color: p.gold },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.footnote}>
            测试版包含 Beta / RC
            版本，可能尚不稳定。更新不会自动重启播放器。下载中退出应用可能需要重新下载。
          </Text>
          {!!u.prefs.checkedAt && (
            <Text style={s.checked}>
              上次检查 {new Date(u.prefs.checkedAt).toLocaleString()}
            </Text>
          )}
        </>
      ) : (
        <>
          <Text style={s.notes}>
            {Platform.OS === "ios"
              ? "iOS 版本请通过 App Store 或 TestFlight 更新。"
              : "当前版本暂不支持应用内安装。请通过原安装渠道获取新版本。"}
          </Text>
        </>
      )}
    </View>
  );
}
const s = themeStyles(() => ({
  page: { gap: 12, paddingBottom: 8 },
  hero: { padding: 14, borderRadius: 16, gap: 6 },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: { color: p.gold, fontSize: 10, letterSpacing: 2 },
  badge: {
    backgroundColor: "#d4b17816",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: { color: p.gold, fontSize: 11 },
  brand: {
    color: p.text,
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.6,
    marginTop: 2,
  },
  version: { color: p.gold, fontSize: 13, fontVariant: ["tabular-nums"] },
  release: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#cbae7638",
    backgroundColor: "#cbae7608",
    gap: 10,
  },
  releaseTitle: { color: p.text, fontSize: 23, fontWeight: "600" },
  small: { color: p.muted, fontSize: 11, lineHeight: 19 },
  downloadMetrics: { flexShrink: 1, fontVariant: ["tabular-nums"] },
  notes: { color: p.text, fontSize: 13, lineHeight: 23 },
  track: {
    height: 4,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#ffffff12",
  },
  fill: { height: 4, backgroundColor: p.gold },
  percent: { color: p.gold, fontSize: 12, fontVariant: ["tabular-nums"] },
  feedback: { flexDirection: "row", gap: 10, alignItems: "center" },
  message: { color: p.gold, fontSize: 12, lineHeight: 21, flex: 1 },
  section: { fontSize: 12, color: p.gold, marginTop: 10, letterSpacing: 1 },
  card: {
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "#ffffff05",
  },
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: p.line,
  },
  rowText: { flex: 1, gap: 3 },
  title: { color: p.text, fontSize: 14, fontWeight: "500" },
  channel: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 13,
    backgroundColor: "#ffffff05",
    gap: 4,
  },
  option: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  selected: { backgroundColor: "#d4b17816" },
  optionText: { color: p.muted, fontSize: 13 },
  footnote: { color: p.muted, fontSize: 11, lineHeight: 20 },
  checked: { color: p.muted, fontSize: 10, textAlign: "center", marginTop: 5 },
}));
