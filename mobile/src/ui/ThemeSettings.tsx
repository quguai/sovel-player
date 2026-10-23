import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { themePresets, validTheme } from "../core/theme";
import { useMusic } from "../services/store";
import { palette as p } from "./visuals";
import { themeStyles } from "./themeStyles";
import { Button } from "./components";
export function ThemeSettings() {
  const { prefs, preferences } = useMusic();
  const [draft, setDraft] = useState(prefs.theme),
    [message, setMessage] = useState("");
  return (
    <View style={{ gap: 12, marginBottom: 22 }}>
      <Text style={s.heading}>主题配色</Text>
      <View style={s.grid}>
        {themePresets.map((theme) => (
          <Pressable
            key={theme.name}
            accessibilityLabel={`${theme.name}配色`}
            accessibilityRole="radio"
            accessibilityState={{
              selected:
                prefs.theme.background === theme.background &&
                prefs.theme.accent === theme.accent,
            }}
            onPress={() => {
              setDraft(theme);
              void preferences({ theme });
              setMessage("");
            }}
            style={[
              s.preset,
              {
                backgroundColor: theme.background,
                borderColor:
                  prefs.theme.accent === theme.accent
                    ? theme.accent
                    : "#ffffff10",
              },
            ]}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: theme.accent,
              }}
            />
            <Text
              style={{ color: theme.accent, fontSize: 14, fontWeight: "500" }}
            >
              {theme.name}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={s.card}>
        <Text style={s.title}>自定义深色主题</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {(
            [
              ["background", "背景颜色"],
              ["accent", "强调颜色"],
            ] as const
          ).map(([key, label]) => (
            <View key={key} style={{ flex: 1, gap: 6 }}>
              <Text style={s.note}>{label}</Text>
              <TextInput
                testID={label}
                accessibilityLabel={label}
                value={draft[key]}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={7}
                onChangeText={(value) =>
                  setDraft((old) => ({ ...old, name: "自定义", [key]: value }))
                }
                style={s.input}
              />
            </View>
          ))}
        </View>
        <View
          style={[
            s.preview,
            {
              backgroundColor: /^#[0-9a-f]{6}$/i.test(draft.background)
                ? draft.background
                : p.bg,
            },
          ]}
        >
          <Text style={s.title}>音乐，听见自己的颜色</Text>
          <Text
            style={{
              fontSize: 12,
              color: /^#[0-9a-f]{6}$/i.test(draft.accent)
                ? draft.accent
                : p.gold,
            }}
          >
            SOVEL HIFI · YOUR COLLECTION
          </Text>
        </View>
        <Button
          disabled={!validTheme(draft)}
          onPress={() => {
            void preferences({ theme: draft });
            setMessage("主题已保存");
          }}
        >
          保存配色
        </Button>
        <Text style={s.note}>
          输入
          #RRGGBB。背景保持深色，并检查强调色对比度；播放器仍使用封面氛围背景。
        </Text>
        {!!message && <Text style={s.message}>{message}</Text>}
      </View>
    </View>
  );
}
const s = themeStyles(() => ({
  heading: { fontSize: 16, fontWeight: "600", color: p.text },
  title: { fontSize: 14, color: p.text },
  note: { fontSize: 12, lineHeight: 18, color: p.muted },
  message: { fontSize: 12, color: p.gold },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  preset: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 48,
  },
  card: {
    padding: 14,
    backgroundColor: "#ffffff05",
    borderRadius: 14,
    gap: 12,
  },
  input: {
    color: p.text,
    backgroundColor: "#00000020",
    borderRadius: 10,
    padding: 10,
    minHeight: 44,
    fontSize: 13,
  },
  preview: {
    gap: 10,
    padding: 16,
    borderRadius: 12,
    minHeight: 90,
    justifyContent: "center",
  },
}));
