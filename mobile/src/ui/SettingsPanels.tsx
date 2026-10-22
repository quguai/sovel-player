import { MusicSourcesScreen } from "./MusicSourcesScreen";
import { UpdateSettings } from "./UpdateSettings";
import { installedApp, useUpdates } from "../services/appUpdates";
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Keyboard,
  Pressable,
  Switch,
  StyleSheet,
} from "react-native";
import { useMusic } from "../services/store";
import { palette as p } from "./visuals";
import { eqPresetName } from "../core/equalizer";
import { EqualizerScreen } from "./EqualizerScreen";
import { BackupSettings } from "./BackupSettings";
import { Button } from "./components";
import { ListeningHistoryScreen } from "./ListeningHistoryScreen";
import { supportsDsf } from "../services/playbackSupport";
import { dsdLicense } from "../core/thirdPartyNotices";
import { pcmRates } from "../core/dsd";

export type SettingsSection =
  | "sources"
  | "root"
  | "appearance"
  | "playback"
  | "sleep"
  | "effects"
  | "peq"
  | "usb"
  | "language"
  | "updates"
  | "about"
  | "dsd"
  | "backup"
  | "history";
export const settingsTitles: Record<SettingsSection, string> = {
  root: "设置",
  sources: "音乐来源",
  appearance: "样式管理",
  playback: "高级设置",
  sleep: "定时停止播放",
  effects: "均衡器",
  peq: "参数均衡器 · PEQ",
  usb: "USB 输出",
  language: "语言设置",
  updates: "版本更新",
  about: "关于 Sovel HiFi",
  dsd: "DSD 模式",
  backup: "备份与恢复",
  history: "听歌记录与偏好",
};
export function SettingRow({
  title,
  note,
  value,
  onPress,
  children,
}: {
  title: string;
  note?: string;
  value?: string;
  onPress?: () => void;
  children?: React.ReactNode;
}) {
  const content = (
    <>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={s.title}>{title}</Text>
        {note && <Text style={s.note}>{note}</Text>}
      </View>
      {children || (value && <Text style={s.value}>{value}</Text>)}
      {onPress && <Text style={s.chevron}>›</Text>}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={s.row}>{content}</View>
  );
}
export function SettingSwitch({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Switch
      accessibilityLabel={label}
      accessibilityState={{ disabled, checked: value }}
      value={value}
      disabled={disabled}
      onValueChange={onChange}
      trackColor={{ false: "#404248", true: p.gold }}
      thumbColor={p.text}
    />
  );
}
export function SettingGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.group}>
      <Text style={s.groupTitle}>{title}</Text>
      <View style={s.card}>{children}</View>
    </View>
  );
}
export function SettingsHome({
  open,
  onSources,
}: {
  open: (section: SettingsSection) => void;
  onSources: () => void;
}) {
  const updates = useUpdates();
  const {
    sources,
    prefs,
    sleepEnd,
    sleepRemaining,
    setSleepTimer,
    setBackgroundPlayback,
    eqStatus,
    nativeSleep,
  } = useMusic();
  return (
    <>
      <Text style={s.intro}>让音乐，按你的习惯播放。</Text>
      <SettingGroup title="曲库与外观">
        <SettingRow
          title="音乐来源"
          note="本地 / Jellyfin / Emby · 聚合与优先级"
          onPress={() => open("sources")}
        />
        <SettingRow
          title="文件扫描"
          note="选择来源、过滤规则与扫描方式"
          value={`${sources.filter((source) => source.kind !== "jellyfin" && source.kind !== "emby").reduce((count, source) => count + (source.trackCount || 0), 0)} 首`}
          onPress={onSources}
        />
        <SettingRow
          title="样式管理"
          note="主页、播放画面与唱片细节"
          onPress={() => open("appearance")}
        />
        <SettingRow
          title="听歌记录与偏好"
          note="收听时长、完成率与本地推荐"
          onPress={() => open("history")}
        />
      </SettingGroup>
      <SettingGroup title="常用设置">
        <SettingRow
          title="定时停止播放"
          note={
            sleepEnd ? `约 ${sleepRemaining} 分钟后暂停` : "开启后默认 30 分钟"
          }
        >
          <SettingSwitch
            label="定时停止播放"
            disabled={!nativeSleep.available}
            value={!!sleepEnd}
            onChange={(enabled) => setSleepTimer(enabled ? 30 : 0)}
          />
        </SettingRow>
        <SettingRow
          title="定时时长"
          value={sleepEnd ? `剩余 ${sleepRemaining} 分钟` : "15 / 30 / 60 分钟"}
          onPress={() => open("sleep")}
        />
        <SettingRow title="后台播放" note="锁屏或离开应用后继续播放">
          <SettingSwitch
            label="后台播放"
            value={prefs.backgroundPlayback}
            onChange={setBackgroundPlayback}
          />
        </SettingRow>
        <SettingRow
          title="均衡器"
          value={
            !eqStatus.available
              ? "需更新安装包"
              : prefs.equalizer.enabled
                ? eqPresetName(prefs.equalizer)
                : "关闭"
          }
          onPress={() => open("effects")}
        />
        <SettingRow title="PEQ" value="未接入" onPress={() => open("peq")} />
      </SettingGroup>
      <SettingGroup title="播放与系统">
        <SettingRow
          title="DSD 模式"
          note="PCM / DoP / Native 与转换采样率"
          value={
            supportsDsf ? `PCM · ${prefs.dsd.pcmRate / 1000} kHz` : "仅索引"
          }
          onPress={() => open("dsd")}
        />
        <SettingRow
          title="高级设置"
          note="播放方式、歌词、过渡与回放增益"
          onPress={() => open("playback")}
        />
        <SettingRow
          title="USB 输出"
          value="系统输出"
          onPress={() => open("usb")}
        />
        <SettingRow
          title="语言设置"
          value="简体中文"
          onPress={() => open("language")}
        />
        <SettingRow
          title="备份与恢复"
          note="外观、扫描规则与 EQ 预设"
          onPress={() => open("backup")}
        />
        <SettingRow
          title="版本更新"
          value={
            updates.release ? updates.release.version : installedApp.version
          }
          onPress={() => open("updates")}
        />
        <SettingRow
          title="关于 Sovel HiFi"
          value={installedApp.version}
          onPress={() => open("about")}
        />
      </SettingGroup>
    </>
  );
}
export function SleepSettings() {
  const { sleepEnd, sleepRemaining, sleepMinutes, setSleepTimer, nativeSleep } =
    useMusic();
  const [custom, setCustom] = useState("30");
  return (
    <>
      <SettingRow
        title="定时停止播放"
        note={
          sleepEnd
            ? `约 ${sleepRemaining} 分钟后暂停`
            : nativeSleep.available
              ? "到时由原生播放器暂停，切歌不重置计时"
              : "需安装新版应用以启用原生定时"
        }
      >
        <SettingSwitch
          label="定时停止播放"
          disabled={!nativeSleep.available}
          value={!!sleepEnd}
          onChange={(enabled) => setSleepTimer(enabled ? 30 : 0)}
        />
      </SettingRow>
      <View style={s.choices}>
        {[15, 30, 60, 90].map((minutes) => (
          <Pressable
            key={minutes}
            accessibilityRole="radio"
            disabled={!nativeSleep.available}
            accessibilityLabel={`睡眠定时 ${minutes} 分钟`}
            accessibilityState={{ selected: sleepMinutes === minutes }}
            onPress={() => setSleepTimer(minutes)}
            style={[s.choice, sleepMinutes === minutes && s.selected]}
          >
            <Text style={s.title}>{minutes} 分钟</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 12, marginVertical: 18 }}>
        <Text style={s.title}>自定义时长</Text>
        <TextInput
          accessibilityLabel="定时分钟数"
          keyboardType="number-pad"
          value={custom}
          onChangeText={setCustom}
          maxLength={3}
          style={{
            color: p.text,
            backgroundColor: "#ffffff08",
            borderRadius: 12,
            padding: 14,
          }}
        />
        <Button
          disabled={
            !nativeSleep.available ||
            !/^\d+$/.test(custom) ||
            Number(custom) < 1 ||
            Number(custom) > 180
          }
          onPress={() => {
            Keyboard.dismiss();
            setSleepTimer(Number(custom));
          }}
        >
          开始自定义定时
        </Button>
      </View>
      <Text style={s.note}>
        1–180
        分钟。暂停、切歌或锁屏不重置倒计时；到时停止播放。应用退出后本次定时结束。
      </Text>
    </>
  );
}
export function AdvancedAudioSettings() {
  return (
    <SettingGroup title="音频行为">
      <SettingRow
        title="耳机拔出暂停"
        note="有线或蓝牙断开时暂停，由系统音频层管理"
        value="已开启"
      />
      <SettingRow
        title="歌曲过渡"
        note="淡入淡出、无缝播放待音频引擎适配"
        value="普通切歌"
      />
      <SettingRow
        title="回放增益"
        note="读取标签并调整音量的处理链尚未接入"
        value="未接入"
      />
    </SettingGroup>
  );
}
export function SettingsInfo({ section }: { section: SettingsSection }) {
  const [details, setDetails] = useState(false);
  const [licenses, setLicenses] = useState(false);
  if (section === "sources") return <MusicSourcesScreen />;
  if (section === "updates") return <UpdateSettings />;
  if (section === "sleep") return <SleepSettings />;
  if (section === "backup") return <BackupSettings />;
  if (section === "history") return <ListeningHistoryScreen />;
  if (section === "effects") return <EqualizerScreen />;
  if (section === "dsd") return <DsdSettingsPanel />;
  if (section === "peq")
    return (
      <SettingGroup title="耳机校正">
        <SettingRow
          title="参数均衡器 · PEQ"
          note="频率、增益、Q 值与 AutoEQ 导入待接入"
        >
          <SettingSwitch
            label="PEQ 尚未接入"
            value={false}
            disabled
            onChange={() => {}}
          />
        </SettingRow>
      </SettingGroup>
    );
  if (section === "usb")
    return (
      <>
        <SettingGroup title="当前输出方式">
          <SettingRow
            title="系统音频输出"
            note="由设备系统选择扬声器、耳机或外接 DAC"
            value="使用中"
          />
          <SettingRow
            title="USB 独占"
            note="Android 专用输出模块尚未接入"
            value="不可用"
          />
          <SettingRow
            title="DSD 直通 / DoP"
            note="需要解码模块及兼容的 USB DAC"
            value="不可用"
          />
        </SettingGroup>
        <Text style={s.note}>
          连接 USB DAC 后仍走系统音频通道。当前版本不承诺独占、原采样率输出或
          Bit-perfect。
        </Text>
      </>
    );
  if (section === "language")
    return (
      <>
        <SettingRow title="简体中文" value="当前语言" />
        <Text style={[s.note, { marginTop: 20 }]}>
          其他语言将在完整翻译后提供。
        </Text>
      </>
    );
  return (
    <>
      <Text
        style={[s.title, { fontSize: 30, color: p.gold, marginVertical: 20 }]}
      >
        Sovel HiFi
      </Text>
      <Text style={s.intro}>收藏声音，慢慢聆听。</Text>
      <SettingGroup title="应用信息">
        <SettingRow title="版本" value={installedApp.version} />
        <SettingRow title="曲库" note="SQLite 本地索引；引用原音频文件" />
        <SettingRow
          title="设计与实现参考"
          value={details ? "收起" : "展开"}
          onPress={() => setDetails(!details)}
        />
        <SettingRow
          title="解码器开源许可"
          value={licenses ? "收起" : "查看"}
          onPress={() => setLicenses(!licenses)}
        />
      </SettingGroup>
      {details && (
        <Text selectable style={s.note}>
          NeriPlayer · 扫描阶段与 USB 能力状态{String.fromCharCode(10)}Auxio ·
          索引、设置分组与 ReplayGain 处理{String.fromCharCode(10)}
          本次借鉴设计与行为，未拷入上述项目的 GPL 源码。
        </Text>
      )}
      {licenses && (
        <Text selectable style={s.note}>
          {dsdLicense}
        </Text>
      )}
    </>
  );
}
function DsdSettingsPanel() {
  const { prefs, setDsdRate } = useMusic();
  const [saving, setSaving] = useState(false);
  return (
    <>
      <Text style={s.intro}>选择 DSD 的播放方式，让输出匹配你的设备。</Text>
      <SettingGroup title="输出模式">
        <SettingRow
          title="PCM"
          note="DSD 转为浮点 PCM，经系统音频输出；可使用均衡器"
          value={supportsDsf ? "使用中" : "需 Android 完整版"}
        />
        <SettingRow
          title="DoP"
          note="将 DSD 封装为 PCM 帧传输，需要兼容 DAC 与直通链路"
          value="尚未接入"
        />
        <SettingRow
          title="Native"
          note="原生 DSD 输出，需要设备或 USB 专用输出接口"
          value="尚未接入"
        />
      </SettingGroup>
      <SettingGroup title="DSD → PCM 采样率">
        {pcmRates.map((rate) => (
          <SettingRow
            key={rate}
            title={`${rate / 1000} kHz`}
            note={
              rate === 176400
                ? "默认 · 音质与负载平衡"
                : rate === 352800
                  ? "输出数据量更大，需要设备支持"
                  : undefined
            }
            value={prefs.dsd.pcmRate === rate ? "已选择" : ""}
            onPress={
              !supportsDsf || saving
                ? undefined
                : async () => {
                    setSaving(true);
                    try {
                      await setDsdRate(rate);
                    } finally {
                      setSaving(false);
                    }
                  }
            }
          />
        ))}
      </SettingGroup>
      <Text style={s.note}>
        {saving ? "正在应用采样率，保留队列与播放位置…\n" : ""}
        支持 DSF 单声道 /
        立体声，DSD64、128、256、512 共用上方选择的采样率。调整采样率会重新载入播放队列，可能短暂停顿。
        {"\n"}少数 48 kHz 系列 DSD 会对应转换为 48 / 96 / 192 / 384 kHz。
        {"\n"}这里设置的是解码后的 PCM 采样率；设备系统仍可能重采样。DFF、DoP 与
        Native 暂不可用。
      </Text>
    </>
  );
}
const s = StyleSheet.create({
  intro: { fontSize: 14, color: p.muted, lineHeight: 23, marginBottom: 12 },
  group: { marginBottom: 23 },
  groupTitle: {
    fontSize: 12,
    color: p.gold,
    marginBottom: 10,
    letterSpacing: 1,
  },
  card: {
    borderRadius: 17,
    overflow: "hidden",
    paddingHorizontal: 16,
    backgroundColor: "#ffffff05",
  },
  row: {
    minHeight: 55,
    paddingVertical: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: p.line,
  },
  title: { color: p.text, fontSize: 15, fontWeight: "500" },
  note: { color: p.muted, fontSize: 12, lineHeight: 19 },
  value: { color: p.muted, fontSize: 12, maxWidth: "46%", textAlign: "right" },
  chevron: { color: p.muted, fontSize: 21 },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginVertical: 24,
  },
  choice: {
    width: "47%",
    padding: 20,
    borderRadius: 14,
    backgroundColor: p.surface,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  selected: { borderColor: p.gold, backgroundColor: "#d5b78212" },
});
