import { themeStyles } from "./themeStyles";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  PanResponder,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import {
  applyEqPreset,
  deleteEqPreset,
  eqFrequencies,
  eqFrequencyLabel,
  eqPresetName,
  eqPresets,
  saveEqPreset,
} from "../core/equalizer";
import { useMusic } from "../services/store";
import { palette as p } from "./visuals";

const db = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)} dB`;
export function EqSlider({
  value,
  min,
  max,
  label,
  change,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  change: (value: number) => void;
}) {
  const width = useRef(1),
    start = useRef(0),
    callback = useRef(change),
    last = useRef(0);
  useEffect(() => {
    callback.current = change;
  }, [change]);
  const send = (x: number) =>
    callback.current(
      Math.round(
        (min + Math.max(0, Math.min(1, x / width.current)) * (max - min)) * 2,
      ) / 2,
    );
  // PanResponder stores callbacks; it reads gesture refs only when input arrives.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        start.current = e.nativeEvent.locationX;
        send(start.current);
      },
      onPanResponderMove: (_, gesture) => {
        if (Date.now() - last.current > 65) {
          last.current = Date.now();
          send(start.current + gesture.dx);
        }
      },
      onPanResponderRelease: (_, gesture) => send(start.current + gesture.dx),
      onPanResponderTerminationRequest: () => false,
    }),
  );
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: db(value) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) =>
        change(
          Math.max(
            min,
            Math.min(
              max,
              value + (e.nativeEvent.actionName === "increment" ? 0.5 : -0.5),
            ),
          ),
        )
      }
      onLayout={(e) => {
        width.current = e.nativeEvent.layout.width;
      }}
      {...responder.panHandlers}
      style={s.slider}
    >
      <View pointerEvents="none" style={s.rail} />
      <View
        pointerEvents="none"
        style={[s.fill, { width: `${(100 * (value - min)) / (max - min)}%` }]}
      />
      <View
        pointerEvents="none"
        style={[s.thumb, { left: `${(100 * (value - min)) / (max - min)}%` }]}
      />
    </View>
  );
}
export function EqualizerScreen() {
  const { prefs, setEqualizer, eqStatus, status } = useMusic();
  const eq = prefs.equalizer;
  const [selected, setSelected] = useState(5),
    [name, setName] = useState(""),
    [message, setMessage] = useState("");
  const editBand = (value: number) =>
    setEqualizer((previous) => ({
      ...previous,
      presetId: "custom",
      gains: previous.gains.map((g, i) => (i === selected ? value : g)),
    }));
  const x = (i: number) => 22 + (i * 256) / 9,
    y = (gain: number) => 88 - gain * 4.8;
  const path = eq.gains
    .map((g, i) => `${i ? "L" : "M"}${x(i)},${y(g)}`)
    .join(" ");
  const processing =
    eq.enabled && status.playing && eqStatus.supported && eqStatus.processing;
  const badge = !eqStatus.available
    ? "需要新版安装包"
    : !eq.enabled
      ? "已关闭"
      : processing
        ? "处理中"
        : "已开启";
  const detail = !eqStatus.available
    ? "原生音效模块未加载，当前不会改变声音。"
    : !eq.enabled
      ? "关闭本级时保留预设，PEQ 和回放增益独立生效。"
      : !status.playing
        ? "播放音乐后应用当前设置。"
        : !eqStatus.supported
          ? "当前音频尚未进入支持的 PCM 处理链。"
          : !eqStatus.processing
            ? "平直设置，当前旁路处理。"
            : `处理链输入 · ${(eqStatus.sampleRate / 1000).toFixed(1)} kHz · ${eqStatus.format === 4 ? "32 位浮点" : `${[0, 16, 24, 32][eqStatus.format]} bit`}`;
  const apply = (id: string) => {
    setMessage("");
    setEqualizer((previous) => applyEqPreset(previous, id));
  };
  const save = () => {
    const id = `user-${Date.now().toString(36)}`;
    try {
      saveEqPreset(eq, name, id); // validate synchronously for the inline form
      setEqualizer((previous) => saveEqPreset(previous, name, id));
      Keyboard.dismiss();
      setName("");
      setMessage("预设已保存");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  const remove = () =>
    Alert.alert("删除这个预设？", "当前频段设置会保留。", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () =>
          setEqualizer((previous) =>
            deleteEqPreset(previous, previous.presetId),
          ),
      },
    ]);
  return (
    <>
      <View style={s.summary}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={s.eyebrow}>GRAPHIC EQUALIZER</Text>
          <Text style={s.heading}>调整你的声音</Text>
        </View>
        <Switch
          accessibilityLabel="启用均衡器"
          accessibilityState={{
            disabled: !eqStatus.available,
            checked: eq.enabled,
          }}
          disabled={!eqStatus.available}
          value={eq.enabled && eqStatus.available}
          onValueChange={(enabled) =>
            setEqualizer((previous) => ({ ...previous, enabled }))
          }
          trackColor={{ false: "#41434a", true: p.gold }}
          thumbColor={p.text}
        />
      </View>
      <View style={s.status}>
        <View
          style={[s.dot, { backgroundColor: processing ? p.gold : p.muted }]}
        />
        <Text
          accessibilityLabel="均衡器运行状态"
          accessibilityValue={{ text: badge }}
          style={s.statusText}
        >
          {badge}
        </Text>
        <Text style={s.currentPreset}>{eqPresetName(eq)}</Text>
      </View>
      <Text accessibilityLabel="均衡器处理链" style={s.note}>
        {detail}
      </Text>
      <View style={s.panel}>
        <View style={s.row}>
          <Text style={s.label}>频段增益</Text>
          <Text style={s.note}>10 段 · ±12 dB</Text>
        </View>
        <Svg width="100%" height={166} viewBox="0 0 300 166" accessible={false}>
          {[-12, 0, 12].map((g) => (
            <React.Fragment key={g}>
              <Line
                x1={22}
                x2={278}
                y1={y(g)}
                y2={y(g)}
                stroke={g === 0 ? "#ffffff25" : "#ffffff0d"}
                strokeDasharray="3 5"
              />
              <SvgText x={2} y={y(g) + 3} fontSize={8} fill={p.muted}>
                {g > 0 ? "+12" : `${g}`}
              </SvgText>
            </React.Fragment>
          ))}
          <Path d={`${path} L278,148 L22,148 Z`} fill={`${p.gold}0b`} />
          <Path d={path} stroke={p.gold} strokeWidth={1.8} fill="none" />
          {eq.gains.map((g, i) => (
            <Circle
              key={i}
              cx={x(i)}
              cy={y(g)}
              r={i === selected ? 5 : 2.6}
              fill={i === selected ? p.text : p.gold}
            />
          ))}
        </Svg>
        <View style={s.bands}>
          {eqFrequencies.map((f, i) => (
            <Pressable
              key={f}
              accessibilityRole="button"
              accessibilityLabel={`调节 ${eqFrequencyLabel(f)} Hz`}
              accessibilityState={{ selected: i === selected }}
              onPress={() => setSelected(i)}
              style={[s.band, i === selected && s.selected]}
            >
              <Text style={[s.bandText, i === selected && { color: p.gold }]}>
                {eqFrequencyLabel(f)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={[s.row, { marginTop: 18 }]}>
          <Text style={s.label}>
            {eqFrequencyLabel(eqFrequencies[selected])} Hz
          </Text>
          <Text style={s.gain}>{db(eq.gains[selected])}</Text>
        </View>
        <View style={s.adjust}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="降低当前频段"
            onPress={() => editBand(Math.max(-12, eq.gains[selected] - 0.5))}
            style={s.step}
          >
            <Text style={s.stepText}>−</Text>
          </Pressable>
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <EqSlider
              key={selected}
              label="当前频段增益"
              value={eq.gains[selected]}
              min={-12}
              max={12}
              change={editBand}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="提高当前频段"
            onPress={() => editBand(Math.min(12, eq.gains[selected] + 0.5))}
            style={s.step}
          >
            <Text style={s.stepText}>+</Text>
          </Pressable>
        </View>
        {eqStatus.supported && eqStatus.activeBands < 10 && (
          <Text style={s.note}>
            当前采样率可处理 {eqStatus.activeBands} 个频段，过高的频段自动旁路。
          </Text>
        )}
      </View>
      <Text style={s.section}>听感预设</Text>
      <View style={s.presets}>
        {[...eqPresets, ...eq.userPresets].map((preset) => (
          <Pressable
            key={preset.id}
            accessibilityRole="button"
            accessibilityLabel={`均衡器预设：${preset.name}`}
            accessibilityState={{ selected: eq.presetId === preset.id }}
            onPress={() => apply(preset.id)}
            style={[s.preset, eq.presetId === preset.id && s.selected]}
          >
            <Text
              style={[
                s.presetText,
                eq.presetId === preset.id && { color: p.gold },
              ]}
            >
              {preset.name}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={s.saveRow}>
        <TextInput
          accessibilityLabel="自定义预设名称"
          placeholder="保存为我的预设"
          placeholderTextColor={p.muted}
          value={name}
          onChangeText={setName}
          autoCorrect={false}
          maxLength={24}
          style={s.input}
          returnKeyType="done"
          onSubmitEditing={save}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="保存均衡器预设"
          onPress={save}
          style={s.save}
        >
          <Text style={s.saveText}>保存</Text>
        </Pressable>
      </View>
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={s.message}>
          {message}
        </Text>
      )}
      {eq.presetId.startsWith("user-") && (
        <Pressable accessibilityRole="button" onPress={remove} style={s.delete}>
          <Text style={s.note}>删除当前预设</Text>
        </Pressable>
      )}
      <Text style={s.section}>增益与余量</Text>
      <View style={s.panel}>
        <View style={s.row}>
          <Text style={s.label}>前级增益</Text>
          <Text style={s.gain}>{db(eq.preamp)}</Text>
        </View>
        <EqSlider
          label="前级增益"
          value={eq.preamp}
          min={-24}
          max={0}
          change={(preamp) =>
            setEqualizer((previous) => ({
              ...previous,
              preamp,
              presetId: "custom",
            }))
          }
        />
        <View style={s.row}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={s.label}>自动留出余量</Text>
            <Text style={s.note}>提升频段时降低前级，减少削波。</Text>
          </View>
          <Switch
            accessibilityLabel="自动留出余量"
            value={eq.headroom}
            onValueChange={(headroom) =>
              setEqualizer((previous) => ({
                ...previous,
                headroom,
                presetId: "custom",
              }))
            }
            trackColor={{ false: "#41434a", true: p.gold }}
            thumbColor={p.text}
          />
        </View>
        {status.playing && eqStatus.processing && (
          <Text
            accessibilityLabel="处理链前级"
            accessibilityValue={{ text: db(eqStatus.effectivePreamp) }}
            style={[s.note, { marginTop: 12 }]}
          >
            处理链前级 {db(eqStatus.effectivePreamp)} · 包含 EQ / PEQ 与回放增益
          </Text>
        )}
      </View>
      <Text style={[s.note, { marginVertical: 16 }]}>
        预设仅调整当前播放器的音色。声音过响或出现失真时，可降低前级增益。
      </Text>
    </>
  );
}
const s = themeStyles(() => ({
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  eyebrow: { fontSize: 9, letterSpacing: 2.2, color: p.gold },
  heading: { fontSize: 21, fontWeight: "600", color: p.text },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 8,
    marginBottom: 8,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { color: p.text, fontSize: 12 },
  currentPreset: { color: p.gold, fontSize: 12, marginLeft: "auto" },
  note: { color: p.muted, fontSize: 11, lineHeight: 18 },
  panel: {
    marginTop: 12,
    backgroundColor: "#ffffff05",
    padding: 12,
    borderRadius: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  label: { color: p.text, fontSize: 13 },
  gain: { color: p.gold, fontSize: 14, fontVariant: ["tabular-nums"] },
  bands: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  band: {
    flexGrow: 1,
    flexBasis: "17%",
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#ffffff04",
  },
  bandText: { color: p.muted, fontSize: 11 },
  selected: { backgroundColor: `${p.gold}19` },
  adjust: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  step: {
    width: 38,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { color: p.gold, fontSize: 24 },
  slider: { height: 48, justifyContent: "center" },
  rail: { height: 3, borderRadius: 2, backgroundColor: "#ffffff18" },
  fill: {
    height: 3,
    position: "absolute",
    borderRadius: 2,
    backgroundColor: p.gold,
  },
  thumb: {
    width: 17,
    height: 17,
    marginLeft: -8.5,
    borderRadius: 9,
    position: "absolute",
    backgroundColor: p.text,
  },
  section: {
    color: p.gold,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 12,
  },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preset: {
    borderRadius: 12,
    backgroundColor: "#ffffff06",
    minHeight: 43,
    paddingHorizontal: 17,
    justifyContent: "center",
  },
  presetText: { color: p.muted, fontSize: 12 },
  saveRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  input: {
    color: p.text,
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: "#ffffff06",
    paddingHorizontal: 12,
  },
  save: {
    minWidth: 57,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: `${p.gold}19`,
  },
  saveText: { color: p.gold, fontSize: 12 },
  message: { color: p.gold, fontSize: 12, marginTop: 10 },
  delete: { alignSelf: "flex-start", minHeight: 40, justifyContent: "center" },
}));
