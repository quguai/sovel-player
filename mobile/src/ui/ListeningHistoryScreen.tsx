import { themeStyles } from "./themeStyles";
import { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { useMusic } from "../services/store";
import { Cover, palette as p } from "./visuals";
import { Button } from "./components";
const durationText = (seconds: number) =>
  seconds < 60
    ? `${Math.floor(seconds)} 秒`
    : seconds < 3600
      ? `${Math.floor(seconds / 60)} 分 ${Math.floor(seconds % 60)} 秒`
      : `${Math.floor(seconds / 3600)} 小时 ${Math.floor(seconds / 60) % 60} 分`;
const reasons: Record<string, string> = {
  completed: "自然播完",
  skip: "主动切歌",
  selected: "选择其他歌曲",
  replay: "重新播放",
  paused: "已暂停",
  error: "播放异常",
  interrupted: "播放中断",
  transition: "切换曲目",
  listening: "已记录",
};
export function ListeningHistoryScreen() {
  const {
    tracks,
    listeningHistory,
    listeningSummary,
    listeningProfile,
    listeningAvailable,
    refreshListening,
    loadMoreListening,
    play,
  } = useMusic();
  useEffect(() => {
    void refreshListening();
  }, [refreshListening]);
  const genres = Object.entries(listeningProfile.genres)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const artists = Object.entries(listeningProfile.artists)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.note}>
        {listeningAvailable
          ? "只保存在此设备，记录实际收听，而非播放进度。"
          : "安装新版应用后，开始记录后台与锁屏收听。"}
      </Text>
      <View style={s.summary}>
        <View style={{ flex: 1 }}>
          <Text style={s.number}>{durationText(listeningSummary.seconds)}</Text>
          <Text style={s.note}>累计收听</Text>
        </View>
        <View>
          <Text style={s.number}>
            {listeningSummary.plays}
            <Text style={s.unit}> 次</Text>
          </Text>
          <Text style={s.note}>播放记录</Text>
        </View>
        <View>
          <Text style={s.number}>
            {listeningSummary.completed}
            <Text style={s.unit}> 次</Text>
          </Text>
          <Text style={s.note}>听满 90%</Text>
        </View>
      </View>
      <View style={s.card}>
        <Text style={s.title}>近期听歌倾向</Text>
        <Text style={s.note}>
          综合近 90 天的完整度、重听、主动跳过，并优先参考近期记录。
        </Text>
        <View style={s.tags}>
          {genres.map(([genre]) => (
            <View key={genre} style={s.tag}>
              <Text style={s.gold}>{genre}</Text>
            </View>
          ))}
        </View>
        {!genres.length && (
          <Text style={s.note}>
            曲风标签或有效收听记录不足，暂不推断曲风。已有歌曲可通过全量扫描补充标签。
          </Text>
        )}
        {!!artists.length && (
          <Text style={s.note}>
            常听歌手 · {artists.map(([name]) => name).join(" / ")}
          </Text>
        )}
      </View>
      <View style={{ gap: 4 }}>
        <Text style={s.title}>最近聆听</Text>
        <Text style={s.note}>
          完成率按听过的不同区间计算，拖动和反复听同一段不会虚增。
        </Text>
      </View>
      {!listeningHistory.length && (
        <Text style={[s.note, { paddingVertical: 20 }]}>
          播放一首本地音乐后，记录会出现在这里。
        </Text>
      )}
      {listeningHistory.map((entry) => {
        const track = tracks.find((t) => t.id === entry.trackId);
        return (
          <Pressable
            key={entry.id}
            disabled={!track}
            onPress={() => track && play(track)}
            accessibilityLabel={`${entry.metadata.title}，实际听了 ${durationText(entry.listenedSeconds)}，完成率 ${entry.completion === null ? "未知" : `${Math.round(entry.completion * 100)}%`}`}
            style={s.row}
          >
            <Cover track={track} size={42} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text numberOfLines={1} style={s.title}>
                {entry.metadata.title}
              </Text>
              <Text numberOfLines={1} style={s.note}>
                {entry.metadata.artist} · {reasons[entry.reason] || "已记录"}
              </Text>
              <Text style={s.note}>
                已听 {durationText(entry.listenedSeconds)} · 拖动{" "}
                {entry.seekCount} 次
              </Text>
              <Text style={s.date}>
                {new Date(entry.startedAt).toLocaleString()}
              </Text>
            </View>
            <Text style={s.gold}>
              {entry.completion === null
                ? "—"
                : `${Math.round(entry.completion * 100)}%`}
            </Text>
          </Pressable>
        );
      })}
      {listeningHistory.length < listeningSummary.plays && (
        <Button secondary onPress={loadMoreListening}>
          更早的记录
        </Button>
      )}
    </View>
  );
}
const s = themeStyles(() => ({
  summary: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    paddingVertical: 6,
  },
  number: { fontSize: 20, color: p.gold, fontWeight: "600", marginBottom: 5 },
  unit: { fontSize: 11 },
  note: { color: p.muted, fontSize: 11, lineHeight: 18 },
  title: { color: p.text, fontSize: 14, fontWeight: "600" },
  card: { backgroundColor: p.surface, borderRadius: 14, padding: 12, gap: 8 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: `${p.gold}15`,
  },
  gold: { color: p.gold, fontSize: 12 },
  date: { color: p.muted, fontSize: 10 },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: p.line,
  },
}));
