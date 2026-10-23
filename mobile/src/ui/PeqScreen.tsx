import { themeStyles } from "./themeStyles";
import { useState } from "react";
import { File } from "expo-file-system";
import {
  Keyboard,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { parseAutoEq, type PeqBand } from "../core/peq";
import { useMusic } from "../services/store";
import { palette as p } from "./visuals";
import { Button } from "./components";
import { EqSlider } from "./EqualizerScreen";
export function PeqScreen() {
  const { prefs, setPeq, eqStatus, status } = useMusic(),
    peq = prefs.peq;
  const [selected, setSelected] = useState(0),
    [message, setMessage] = useState(""),
    [text, setText] = useState(""),
    [showImport, setShowImport] = useState(false);
  const [entryRevision, setEntryRevision] = useState(0);
  const band = peq.bands[selected];
  const edit = (patch: Partial<PeqBand>) =>
    void setPeq((old) => ({
      ...old,
      bands: old.bands.map((b, i) => (i === selected ? { ...b, ...patch } : b)),
    }));
  const apply = (value: string) => {
    try {
      const next = parseAutoEq(value);
      if (!setPeq(() => next)) return;
      setSelected(0);
      setMessage(`已导入 ${next.bands.length} 个滤波器`);
      setShowImport(false);
      Keyboard.dismiss();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <View style={{ gap: 14 }}>
      <View style={s.row}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.eyebrow}>PARAMETRIC EQ</Text>
          <Text style={s.heading}>让耳机更合心意</Text>
        </View>
        <Switch
          accessibilityLabel="启用 PEQ"
          disabled={!eqStatus.available}
          value={peq.enabled}
          onValueChange={(enabled) =>
            void setPeq((old) => ({ ...old, enabled }))
          }
          trackColor={{ true: p.gold, false: "#404248" }}
          thumbColor={p.text}
        />
      </View>
      <Text
        accessibilityLabel="PEQ 运行状态"
        accessibilityValue={{
          text: !peq.enabled
            ? "关闭"
            : status.playing && eqStatus.processing
              ? "处理中"
              : "已开启",
        }}
        style={s.value}
      >
        {!peq.enabled
          ? "关闭"
          : status.playing && eqStatus.processing
            ? `处理中 · ${eqStatus.sampleRate / 1000} kHz`
            : "已开启 · 播放时应用"}
      </Text>
      <Text style={s.note}>
        独立的参数均衡器 · 最多 10 段 · 与图示 EQ
        叠加。超过当前采样率上限的频段自动旁路。
      </Text>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.title}>前级增益</Text>
          <Text style={s.value}>{peq.preamp.toFixed(1)} dB</Text>
        </View>
        <EqSlider
          value={peq.preamp}
          min={-24}
          max={0}
          label="PEQ 前级增益"
          change={(preamp) => setPeq((old) => ({ ...old, preamp }))}
        />
        <View style={s.row}>
          <Text style={s.title}>自动预留余量</Text>
          <Switch
            accessibilityLabel="PEQ 自动预留余量"
            value={peq.headroom}
            onValueChange={(headroom) =>
              void setPeq((old) => ({ ...old, headroom }))
            }
            trackColor={{ true: p.gold, false: "#404248" }}
          />
        </View>
      </View>
      <View style={s.bands}>
        {peq.bands.map((b, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`滤波器 ${i + 1}`}
            onPress={() => setSelected(i)}
            style={[s.chip, i === selected && s.active]}
          >
            <Text style={[s.title, { opacity: b.enabled ? 1 : 0.4 }]}>
              {i + 1} · {b.type}
            </Text>
            <Text style={s.note}>{b.frequency} Hz</Text>
          </Pressable>
        ))}
      </View>
      {band && (
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.title}>滤波器 {selected + 1}</Text>
            <Switch
              accessibilityLabel="启用当前滤波器"
              trackColor={{ true: p.gold, false: "#404248" }}
              thumbColor={p.text}
              value={band.enabled}
              onValueChange={(enabled) => edit({ enabled })}
            />
          </View>
          <View style={s.row}>
            {(["PK", "LSC", "HSC"] as const).map((type, i) => (
              <Pressable
                key={type}
                onPress={() => edit({ type })}
                style={[s.chip, { flex: 1 }, band.type === type && s.active]}
              >
                <Text style={s.title}>{["峰值", "低架", "高架"][i]}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.row}>
            {(
              [
                ["frequency", "频率 Hz", 10, 24000],
                ["gain", "增益 dB", -24, 24],
                ["q", "Q 值", 0.1, 20],
              ] as const
            ).map(([key, label, min, max]) => (
              <View
                key={`${selected}-${key}-${band[key]}-${entryRevision}`}
                style={{ flex: 1, gap: 6 }}
              >
                <Text style={s.note}>{label}</Text>
                <TextInput
                  accessibilityLabel={label}
                  defaultValue={String(band[key])}
                  keyboardType="numbers-and-punctuation"
                  selectTextOnFocus
                  style={s.input}
                  onEndEditing={(e) => {
                    const n = Number(e.nativeEvent.text);
                    if (
                      e.nativeEvent.text.trim() &&
                      Number.isFinite(n) &&
                      n >= min &&
                      n <= max
                    ) {
                      edit({ [key]: n });
                      setMessage("");
                    } else {
                      setMessage(`${label}范围 ${min}–${max}`);
                      setEntryRevision((n) => n + 1);
                    }
                  }}
                />
              </View>
            ))}
          </View>
          <Button
            secondary
            onPress={() => {
              setPeq((old) => ({
                ...old,
                bands: old.bands.filter((_, i) => i !== selected),
              }));
              setSelected(Math.max(0, selected - 1));
            }}
          >
            移除当前滤波器
          </Button>
        </View>
      )}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Button
            secondary
            disabled={peq.bands.length >= 10}
            onPress={() => {
              setSelected(peq.bands.length);
              setPeq((old) => ({
                ...old,
                bands: [
                  ...old.bands,
                  { enabled: true, type: "PK", frequency: 1000, gain: 0, q: 1 },
                ],
              }));
            }}
          >
            添加频段
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button onPress={() => setShowImport(!showImport)}>
            导入 AutoEQ
          </Button>
        </View>
      </View>
      {showImport && (
        <View style={s.card}>
          <Text style={s.title}>Equalizer APO 参数文本</Text>
          <Text style={s.note}>
            支持 PK / LSC / HSC 与 Q 值格式。导入后替换当前
            PEQ；不自动联网获取耳机预设。
          </Text>
          <Button
            secondary
            onPress={async () => {
              try {
                const result = await File.pickFileAsync({
                  mimeTypes: ["text/plain"],
                });
                if (result.canceled) return;
                if (result.result.size > 65536)
                  throw new Error("文件不能超过 64 KB");
                apply(await result.result.text());
              } catch (e) {
                setMessage(String(e));
              }
            }}
          >
            选择 TXT 文件
          </Button>
          <TextInput
            testID="AutoEQ 参数文本"
            accessibilityLabel="AutoEQ 参数文本"
            placeholder="Preamp: -6 dB"
            placeholderTextColor={p.muted}
            value={text}
            onChangeText={setText}
            multiline
            style={[s.input, { minHeight: 110, textAlignVertical: "top" }]}
            maxLength={65536}
          />
          <Button disabled={!text.trim()} onPress={() => apply(text)}>
            应用参数
          </Button>
        </View>
      )}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={s.value}>
          {message}
        </Text>
      )}
      <Text style={s.note}>
        设置随备份保存。自动余量按叠加后的频响计算；开启音效后不属于 Bit-perfect
        输出。
      </Text>
    </View>
  );
}
const s = themeStyles(() => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  heading: { fontSize: 22, fontWeight: "600", color: p.text },
  eyebrow: { fontSize: 10, letterSpacing: 2, color: p.gold },
  title: { fontSize: 13, color: p.text },
  note: { fontSize: 12, lineHeight: 18, color: p.muted },
  value: { fontSize: 13, color: p.gold },
  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#ffffff06",
    gap: 12,
  },
  bands: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#ffffff08",
    gap: 3,
  },
  active: { backgroundColor: `${p.gold}26` },
  input: {
    backgroundColor: "#00000020",
    padding: 10,
    borderRadius: 10,
    color: p.text,
    minHeight: 44,
  },
}));
