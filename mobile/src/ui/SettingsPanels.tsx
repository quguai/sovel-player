import { AboutBrandCard } from "./AboutBrandCard";
import { themeStyles } from "./themeStyles";
import { PeqScreen } from "./PeqScreen";
import { isRemoteSource } from "../core/types";
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
import { EqSlider, EqualizerScreen } from "./EqualizerScreen";
import { BackupSettings } from "./BackupSettings";
import { Button } from "./components";
import { ListeningHistoryScreen } from "./ListeningHistoryScreen";
import { supportsDsf } from "../services/playbackSupport";
import { dsdLicense, networkLicenses } from "../core/thirdPartyNotices";
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
      <View style={{ flex: 1, gap: 3 }}>
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
      accessibilityValue={value ? { text: value } : undefined}
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
      <SettingGroup title="曲库与外观">
        <SettingRow
          title="音乐来源"
          value={`${sources.length} 个来源`}
          onPress={() => open("sources")}
        />
        <SettingRow
          title="文件扫描"
          value={`${sources.filter((source) => !isRemoteSource(source)).reduce((count, source) => count + (source.trackCount || 0), 0)} 首`}
          onPress={onSources}
        />
        <SettingRow
          title="样式管理"
          value={prefs.theme.name}
          onPress={() => open("appearance")}
        />
        <SettingRow title="听歌记录与偏好" onPress={() => open("history")} />
      </SettingGroup>
      <SettingGroup title="常用设置">
        <SettingRow
          title="定时停止播放"
          note={sleepEnd ? `约 ${sleepRemaining} 分钟后暂停` : undefined}
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
        <SettingRow title="后台播放">
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
        <SettingRow
          title="PEQ / AutoEQ"
          value={prefs.peq.enabled ? `${prefs.peq.bands.length} 段` : "关闭"}
          onPress={() => open("peq")}
        />
      </SettingGroup>
      <SettingGroup title="播放与系统">
        <SettingRow
          title="DSD 模式"
          value={
            supportsDsf ? `PCM · ${prefs.dsd.pcmRate / 1000} kHz` : "仅索引"
          }
          onPress={() => open("dsd")}
        />
        <SettingRow title="高级设置" onPress={() => open("playback")} />
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
        <SettingRow title="备份与恢复" onPress={() => open("backup")} />
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
      <View style={{ gap: 10, marginVertical: 12 }}>
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
            minHeight: 44,
            padding: 12,
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
  const { prefs, setReplayGain } = useMusic();
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
        note="使用文件内的 ReplayGain 标签；没有标签时保持原音量"
      />
      {(["off", "track", "album"] as const).map((mode, i) => (
        <SettingRow
          key={mode}
          title={["关闭", "按歌曲", "按专辑"][i]}
          note={
            mode === "album"
              ? "整张专辑保留曲目间的音量关系；缺少专辑标签时使用歌曲标签"
              : undefined
          }
          value={prefs.replayGain.mode === mode ? "已选择" : undefined}
          onPress={() => setReplayGain({ mode })}
        />
      ))}
      <SettingRow
        title="峰值保护"
        note="根据标签中的峰值限制放大；未写入峰值时无法预判削波"
      >
        <SettingSwitch
          label="回放增益峰值保护"
          value={prefs.replayGain.preventClipping}
          onChange={(preventClipping) => setReplayGain({ preventClipping })}
        />
      </SettingRow>
      <View style={{ padding: 14 }}>
        <Text style={s.title}>
          回放增益前级 · {prefs.replayGain.preamp.toFixed(1)} dB
        </Text>
        <EqSlider
          value={prefs.replayGain.preamp}
          min={-12}
          max={12}
          label="回放增益前级"
          change={(preamp) => setReplayGain({ preamp })}
        />
      </View>
      <Text style={s.note}>
        已有曲库可执行“全量扫描”以补齐增益信息。开启 EQ / PEQ
        时仍需预留音效余量。
      </Text>
    </SettingGroup>
  );
}
export function SettingsInfo({ section }: { section: SettingsSection }) {
  const [licenses, setLicenses] = useState(false);
  if (section === "sources") return <MusicSourcesScreen />;
  if (section === "updates") return <UpdateSettings />;
  if (section === "sleep") return <SleepSettings />;
  if (section === "backup") return <BackupSettings />;
  if (section === "history") return <ListeningHistoryScreen />;
  if (section === "effects") return <EqualizerScreen />;
  if (section === "dsd") return <DsdSettingsPanel />;
  if (section === "peq") return <PeqScreen />;
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
        <Text style={[s.note, { marginTop: 12 }]}>
          其他语言将在完整翻译后提供。
        </Text>
      </>
    );
  return (
    <>
      <AboutBrandCard version={installedApp.version} />
      <SettingGroup title="应用信息">
        <SettingRow title="曲库" note="SQLite 本地索引；引用原音频文件" />
        <SettingRow
          title="第三方开源许可"
          value={licenses ? "收起" : "查看"}
          onPress={() => setLicenses(!licenses)}
        />
      </SettingGroup>
      {licenses && (
        <Text selectable style={s.note}>
          {dsdLicense}
          {"\n\n"}
          {networkLicenses}
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
      <SettingGroup title="输出模式">
        <SettingRow
          title="PCM"
          note="DSD 转为浮点 PCM，经系统音频输出；可使用均衡器"
          value={supportsDsf ? "使用中" : "需支持软件解码的安装包"}
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
        支持 DSF 单声道 / 立体声，DSD64、128、256、512
        共用上方选择的采样率。调整采样率会重新载入播放队列，可能短暂停顿。
        {"\n"}少数 48 kHz 系列 DSD 会对应转换为 48 / 96 / 192 / 384 kHz。
        {"\n"}这里设置的是解码后的 PCM 采样率；设备系统仍可能重采样。DFF、DoP 与
        Native 暂不可用。
      </Text>
    </>
  );
}
const s = themeStyles(() => ({
  intro: { fontSize: 13, color: p.muted, lineHeight: 20, marginBottom: 10 },
  group: { marginBottom: 16 },
  groupTitle: {
    fontSize: 12,
    color: p.gold,
    marginBottom: 7,
    letterSpacing: 1,
  },
  card: {
    borderRadius: 14,
    overflow: "hidden",
    paddingHorizontal: 14,
    backgroundColor: "#ffffff05",
  },
  row: {
    minHeight: 48,
    paddingVertical: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: p.line,
  },
  title: { color: p.text, fontSize: 15, fontWeight: "500" },
  note: { color: p.muted, fontSize: 12, lineHeight: 17 },
  value: { color: p.muted, fontSize: 12, maxWidth: "46%", textAlign: "right" },
  chevron: { color: p.muted, fontSize: 21 },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginVertical: 12,
  },
  choice: {
    width: "47%",
    minHeight: 48,
    padding: 12,
    borderRadius: 14,
    backgroundColor: p.surface,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  selected: { borderColor: p.gold, backgroundColor: `${p.gold}12` },
}));
