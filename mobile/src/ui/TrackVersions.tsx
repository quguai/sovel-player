import { themeStyles } from "./themeStyles";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Track } from "../core/types";
import { useMusic } from "../services/store";
import { canPlay } from "../services/playbackSupport";
import { Cover, Icon, palette as p } from "./visuals";
export function TrackVersions({
  track,
  onClose,
  onPlay,
}: {
  track: Track | null;
  onClose: () => void;
  onPlay: (track: Track) => void;
}) {
  const { catalogCopies, preferCopy } = useMusic();
  const [copies, setCopies] = useState<Track[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let live = true;
    if (track?.songKey)
      void catalogCopies(track.songKey)
        .then((items) => {
          if (live) setCopies(items);
        })
        .catch(() => {
          if (live) setError("无法读取歌曲来源，请重试");
        });
    return () => {
      live = false;
    };
  }, [catalogCopies, track?.songKey]);
  return (
    <Modal
      visible={!!track}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="关闭版本选择"
          onPress={onClose}
        />
        <SafeAreaView edges={["bottom"]} style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.eyebrow}>ONE SONG · YOUR SOURCES</Text>
          <View style={s.heading}>
            <Text style={s.title}>选择播放版本</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="关闭">
              <Icon name="close" size={20} color={p.muted} />
            </Pressable>
          </View>
          <Text style={s.note}>选择后记住偏好，仅使用已勾选的来源。</Text>
          <ScrollView style={{ maxHeight: 350 }}>
            {copies.map((copy) => (
              <Pressable
                key={copy.id}
                accessibilityRole="button"
                accessibilityLabel={`使用 ${copy.sourceName} 的 ${copy.format} 版本`}
                disabled={saving || !canPlay(copy)}
                onPress={() => {
                  setSaving(true);
                  setError("");
                  void preferCopy(copy.songKey!, copy.id)
                    .then(() => {
                      onPlay(copy);
                      onClose();
                    })
                    .catch(() => setError("版本选择未能保存，请重试"))
                    .finally(() => setSaving(false));
                }}
                style={({ pressed }) => [
                  s.row,
                  { opacity: !canPlay(copy) ? 0.4 : pressed ? 0.65 : 1 },
                ]}
              >
                <Cover track={copy} size={46} />
                <View style={{ flex: 1, gap: 5 }}>
                  <Text numberOfLines={1} style={s.name}>
                    {copy.sourceName}
                  </Text>
                  <Text style={s.note}>
                    {copy.format} · {copy.bits ? `${copy.bits}bit / ` : ""}
                    {copy.sampleRate
                      ? `${copy.sampleRate / 1000}kHz`
                      : "原文件"}
                  </Text>
                </View>
                <Icon
                  name={copy.id === track?.id ? "check" : "play"}
                  size={18}
                  color={copy.id === track?.id ? p.gold : p.muted}
                />
              </Pressable>
            ))}
          </ScrollView>
          {saving && <ActivityIndicator color={p.gold} />}
          {!!error && <Text style={{ color: "#edaa95" }}>{error}</Text>}
          <Pressable
            style={s.auto}
            disabled={saving}
            onPress={() => {
              if (track?.songKey)
                void preferCopy(track.songKey, null)
                  .then(onClose)
                  .catch(() => setError("无法保存，请重试"));
            }}
          >
            <Text style={{ color: p.gold, fontSize: 13 }}>
              恢复自动选择 · 无损与本地优先
            </Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
const s = themeStyles(() => ({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#00000070",
  },
  sheet: {
    backgroundColor: "#242528",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 18,
  },
  handle: {
    width: 34,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#ffffff25",
    alignSelf: "center",
    marginVertical: 13,
  },
  eyebrow: { color: p.gold, fontSize: 9, letterSpacing: 2, marginTop: 10 },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 12,
  },
  title: { color: p.text, fontSize: 23, fontWeight: "600" },
  note: { color: p.muted, fontSize: 11, lineHeight: 19 },
  name: { color: p.text, fontSize: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: p.line,
  },
  auto: {
    minHeight: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
}));
