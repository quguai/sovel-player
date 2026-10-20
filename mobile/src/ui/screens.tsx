import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  ScrollView,
  useWindowDimensions,
  BackHandler,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurTargetView } from "expo-blur";
import { useMusic } from "../services/store";
import { canPlay, supportsDsf } from "../services/playbackSupport";
import { sourceStatus, trackUri } from "../services/files";
import {
  recordSpeeds,
  stylusLights,
  type StylusLight,
  playbackModes,
  type PlaybackMode,
  type Track,
  type HomeStyle,
  type RecordStyle,
  type RecordSpeed,
  type TonearmStyle,
} from "../core/types";
import { CartridgeColorOptions } from "./CartridgeColorOptions";
import { currentLyric, lyricSeekTime } from "../core/lyrics";
import { LyricLine } from "./LyricLine";
import { trackDetails } from "../core/trackDetails";
import { Action, Button, MiniPlayer, PlaybackControls } from "./components";
import {
  Cover,
  Icon,
  Record,
  materials,
  tonearmStyles,
  TonearmSprite,
  palette as p,
} from "./visuals";
import {
  SettingsHome,
  SettingsInfo,
  AdvancedAudioSettings,
  settingsTitles,
  type SettingsSection,
} from "./SettingsPanels";
import { CollectionItem } from "./CollectionItem";
import { FileScanScreen } from "./FileScanScreen";
import { LibraryHighlights } from "./LibraryHighlights";
import {
  dailySelection,
  localDayKey,
  relatedSelection,
} from "../core/discovery";

export function LibraryScreen({
  onPlayer,
  onSettings,
  onQueue,
}: {
  onPlayer: () => void;
  onSettings: () => void;
  onQueue: () => void;
}) {
  const {
    tracks,
    prefs,
    current,
    play,
    resume,
    preferences,
    restoreNote,
    importMusic,
    busy,
    status,
    listeningProfile,
  } = useMusic();
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(false),
    [tab, setTab] = useState<"albums" | "tracks" | "artists" | "folders">(
      "albums",
    ),
    [filter, setFilter] = useState(""),
    [favorites, setFavorites] = useState(false);
  const [mix, setMix] = useState<{ title: string; ids: string[] } | null>(null);
  const highlightsOffset = useRef(0);
  const day = localDayKey();
  const playable = useMemo(() => tracks.filter(canPlay), [tracks]);
  const daily = useMemo(() => dailySelection(playable, day), [playable, day]);
  const related = useMemo(
    () => relatedSelection(playable, current, listeningProfile),
    [playable, current, listeningProfile],
  );
  const openMix = (title: string, songs: Track[]) => {
    setMix({ title, ids: songs.map((song) => song.id) });
    setFavorites(false);
    setQuery("");
    setFilter("");
    setTab("tracks");
  };
  const { width, height } = useWindowDimensions();
  const blurTarget = useRef<ComponentRef<typeof View> | null>(null);
  const landscape = width > height;
  const compact = landscape || height < 740;
  const barHeight = compact ? 52 : 56;
  const dockBottom = compact ? 8 : 10;
  const dockHeight =
    (landscape ? barHeight : current ? barHeight + 4 + 44 : 44) + dockBottom;
  const columns = width > 650 ? 4 : 2;
  const [previousHome, setPreviousHome] = useState(prefs.home);
  if (previousHome !== prefs.home) {
    setPreviousHome(prefs.home);
    setTab(prefs.home === "gallery" ? "albums" : "tracks");
    setFilter("");
    setMix(null);
  }
  const { base, shown, grouped, groups, rows, groupValue } = useMemo(() => {
    const trackById = new Map(tracks.map((t) => [t.id, t]));
    const sourceTracks = mix
      ? mix.ids.map((id) => trackById.get(id)).filter((t): t is Track => !!t)
      : tracks;
    const base = sourceTracks.filter(
      (t) =>
        (!favorites || t.favorite) &&
        `${t.title} ${t.artist} ${t.album} ${t.path}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
    const groupValue = (t: Track) =>
      tab === "albums"
        ? `${t.album}\u0000${t.albumArtist || t.artist}`
        : tab === "artists"
          ? t.artist
          : t.path.includes("/")
            ? t.path.split("/").slice(0, -1).join("/")
            : "导入的音乐";
    const shown = filter ? base.filter((t) => groupValue(t) === filter) : base;
    const grouped = tab !== "tracks" && !filter;
    const groups = new Map<string, Track[]>();
    if (grouped)
      base.forEach((t) => {
        const key = groupValue(t);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(t);
      });
    const rows = grouped ? [...groups.values()].map((g) => g[0]) : shown;
    return { base, shown, grouped, groups, rows, groupValue };
  }, [tracks, mix, favorites, query, tab, filter]);
  const layout = tab === "artists" ? prefs.artistLayout : prefs.albumLayout;
  const grid = grouped && (tab === "folders" || layout === "cards");
  const choose = (track: Track) => {
    if (grouped) setFilter(groupValue(track));
    else {
      play(track, shown);
      if (canPlay(track)) onPlayer();
    }
  };
  const header = (
    <View>
      <View
        style={[
          s.top,
          {
            paddingTop: landscape ? 8 : compact ? 12 : 22,
            paddingBottom: landscape ? 10 : 16,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          {!landscape && (
            <Text style={s.eyebrow}>YOUR PERSONAL COLLECTION</Text>
          )}
          <Text style={[s.heading, { fontSize: landscape ? 24 : 28 }]}>
            {favorites
              ? "我喜欢"
              : prefs.home === "quiet"
                ? "静听"
                : "我的音乐"}
            <Text style={{ color: p.gold }}> .</Text>
          </Text>
        </View>
        <Action
          icon="search"
          label="搜索音乐"
          onPress={() => setSearch(!search)}
        />
      </View>
      {search && (
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="歌曲、专辑、艺术家…"
          placeholderTextColor={p.muted}
          accessibilityLabel="搜索音乐"
          style={s.search}
        />
      )}
      {tracks.length > 0 && (
        <LibraryHighlights
          current={current}
          daily={daily}
          related={related}
          favorites={tracks.filter((t) => t.favorite)}
          scrollPositionRef={highlightsOffset}
          onDaily={() =>
            openMix("每日精选", dailySelection(playable, localDayKey()))
          }
          onRelated={() => openMix("猜你喜欢", related)}
          onFavorites={() => {
            setMix(null);
            setFavorites(true);
            setQuery("");
            setFilter("");
            setTab("tracks");
          }}
          onResume={() => {
            if (current) {
              if (canPlay(current)) resume();
              onPlayer();
            } else if (daily[0]) {
              play(daily[0], daily);
              onPlayer();
            }
          }}
        />
      )}
      {!tracks.length && !query && !favorites && (
        <View style={s.emptyHero}>
          <Text style={s.heroTitle}>{"收藏声音，\n从一首歌开始。"}</Text>
          <Text style={s.subtitle}>选择音乐文件夹，直接索引原文件。</Text>
          <View style={{ gap: 12, marginTop: 20 }}>
            <Button disabled={busy} onPress={() => importMusic("folder")}>
              导入音乐文件夹
            </Button>
          </View>
        </View>
      )}
      <View style={[s.tabs, { marginTop: 8 }]}>
        {(
          [
            ["albums", "专辑"],
            ["tracks", "歌曲"],
            ["artists", "艺术家"],
            ["folders", "文件夹"],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => {
              setTab(key);
              setFilter("");
              setMix(null);
            }}
            style={[s.tab, tab === key && s.tabActive]}
            accessibilityRole="tab"
            accessibilityLabel={`按${label}浏览`}
            accessibilityState={{ selected: tab === key }}
          >
            <Text
              style={{
                color: tab === key ? p.text : p.muted,
                fontSize: 14,
                fontWeight: tab === key ? "700" : "400",
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {tracks.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 4,
            minHeight: 44,
          }}
        >
          {grouped && tab !== "folders" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${tab === "albums" ? "专辑" : "艺术家"}切换为${layout === "cards" ? "列表" : "卡片"}`}
              onPress={() =>
                void preferences(
                  tab === "albums"
                    ? { albumLayout: layout === "cards" ? "list" : "cards" }
                    : { artistLayout: layout === "cards" ? "list" : "cards" },
                )
              }
              style={({ pressed }) => ({
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Icon
                name={layout === "cards" ? "grid" : "list"}
                color={p.gold}
                size={18}
              />
              <Text style={{ color: p.gold, fontSize: 12 }}>
                {layout === "cards" ? "封面视图" : "列表视图"}
              </Text>
            </Pressable>
          ) : mix ? (
            <Pressable
              accessibilityLabel="返回全部音乐"
              onPress={() => setMix(null)}
              style={{
                flexDirection: "row",
                gap: 7,
                alignItems: "center",
                minHeight: 44,
              }}
            >
              <Icon name="back" color={p.gold} size={15} />
              <Text style={{ color: p.gold, fontSize: 12 }}>{mix.title}</Text>
            </Pressable>
          ) : (
            <Text style={s.tiny}>
              {grouped
                ? "音乐目录"
                : filter
                  ? "歌曲列表"
                  : favorites
                    ? "喜欢的音乐"
                    : "全部歌曲"}
            </Text>
          )}
          <Text style={{ color: p.muted, fontSize: 11, letterSpacing: 0.4 }}>
            {grouped
              ? `${groups.size} ${tab === "albums" ? "张专辑" : tab === "artists" ? "位艺术家" : "个文件夹"} · ${base.length} 首`
              : `${shown.length} 首歌曲`}
          </Text>
        </View>
      )}
      {!!restoreNote && (
        <Text style={[s.tiny, { marginTop: 8 }]}>{restoreNote}</Text>
      )}
      {!!filter && (
        <Pressable
          onPress={() => setFilter("")}
          style={[
            s.row,
            { justifyContent: "flex-start", paddingVertical: 16, gap: 6 },
          ]}
        >
          <Icon name="back" size={17} color={p.gold} />
          <Text style={{ color: p.gold }}>
            {filter.split("\u0000")[0]} · {shown.length} 首
          </Text>
        </Pressable>
      )}
    </View>
  );
  return (
    <View style={{ flex: 1 }}>
      <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
        <FlatList
          key={`${grid ? columns : 1}-${tab}`}
          numColumns={grid ? columns : 1}
          data={rows}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingBottom: dockHeight + 16,
          }}
          scrollIndicatorInsets={{ bottom: dockHeight }}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <Text
              style={[s.subtitle, { marginVertical: 30, textAlign: "center" }]}
            >
              {mix && !base.length
                ? "暂时没有合适的歌曲\n收藏更多音乐，或先听听每日精选"
                : tracks.length
                  ? "没有找到匹配的音乐"
                  : "你的音乐，将出现在这里"}
            </Text>
          }
          columnWrapperStyle={grid ? { gap: 14 } : undefined}
          renderItem={({ item }) =>
            grouped ? (
              <CollectionItem
                kind={tab as "albums" | "artists" | "folders"}
                tracks={groups.get(groupValue(item))!}
                title={groupValue(item).split("\u0000")[0]}
                layout={grid ? "cards" : "list"}
                width={(width - 48 - 14 * (columns - 1)) / columns}
                onPress={() => choose(item)}
              />
            ) : (
              <Pressable
                onPress={() => choose(item)}
                style={s.trackRow}
                accessibilityLabel={`播放 ${item.title}`}
              >
                <Cover track={item} size={48} />
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      s.trackTitle,
                      item.id === current?.id && { color: p.gold },
                    ]}
                  >
                    {item.title}
                  </Text>
                  <Text numberOfLines={1} style={s.tiny}>
                    {item.artist} ·{" "}
                    {item.available ? item.format : "文件不可用"}
                    {!canPlay(item) && item.available ? " · 待解码支持" : ""}
                  </Text>
                </View>
                {item.id === current?.id ? (
                  <Icon
                    name={status.playing ? "pause" : "play"}
                    size={17}
                    color={p.gold}
                  />
                ) : (
                  <Text style={s.tiny}>{item.favorite ? "♥" : ""}</Text>
                )}
              </Pressable>
            )
          }
        />
      </BlurTargetView>
      <View
        pointerEvents="box-none"
        style={[
          s.libraryDock,
          { bottom: dockBottom },
          landscape && { flexDirection: "row", gap: 10 },
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={["#17191c00", "#17191ce6", "#17191c", "#17191c"]}
          locations={[0, 0.24, 0.45, 1]}
          style={{
            position: "absolute",
            top: -26,
            left: -12,
            right: -12,
            bottom: -dockBottom,
          }}
        />
        <MiniPlayer
          onOpen={onPlayer}
          onQueue={onQueue}
          blurTarget={blurTarget}
          compact={compact}
          landscape={landscape}
        />
        <View
          style={[
            s.nav,
            { height: 44 },
            landscape && current ? { width: 216 } : undefined,
            landscape && !current ? { flex: 1 } : undefined,
          ]}
        >
          {[
            ["library", "音乐库"],
            ["heart", "我喜欢"],
            ["settings", "设置"],
          ].map(([name, label], i) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{
                selected: (i === 0 && !favorites) || (i === 1 && favorites),
              }}
              key={name}
              onPress={() =>
                i === 2
                  ? onSettings()
                  : (setFavorites(i === 1), setFilter(""), setMix(null))
              }
              style={({ pressed }) => [
                s.navItem,
                { opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Text
                style={[
                  s.tiny,
                  {
                    color:
                      (i === 0 && !favorites) || (i === 1 && favorites)
                        ? p.gold
                        : p.muted,
                    fontSize: compact ? 13 : 14,
                    fontWeight:
                      (i === 0 && !favorites) || (i === 1 && favorites)
                        ? "600"
                        : "400",
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
export function PlayerScreen({
  onClose,
  onLyrics,
  onQueue,
  onDetails,
  animateLyrics = true,
}: {
  onClose: () => void;
  onLyrics: () => void;
  onQueue: () => void;
  onDetails: () => void;
  animateLyrics?: boolean;
}) {
  const { current, prefs, status, favorite, lyricOffset } = useMusic();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const vinyl = prefs.player === "vinyl";
  const compact = landscape || height < 740;
  const [artHeight, setArtHeight] = useState(0);
  const preferredArtSize = vinyl
    ? landscape
      ? Math.min(height - 76, width * 0.46)
      : width - 16
    : landscape
      ? Math.min(height - 150, width * 0.42)
      : Math.min(width - 58, height * 0.38);
  const artSize =
    (vinyl ? 0.92 : 1) *
    Math.min(
      preferredArtSize,
      artHeight
        ? prefs.player === "vinyl"
          ? (artHeight - 4) / 1.06
          : (artHeight - 14) / 1.11
        : preferredArtSize,
    );
  const recordLift = Math.min(landscape ? 6 : 12, artHeight * 0.03);
  const lines = current?.lyrics || [],
    index = currentLyric(lines, status.currentTime, lyricOffset);
  if (!current)
    return (
      <View style={s.center}>
        <Text style={s.subtitle}>先导入一首音乐</Text>
        <Button onPress={onClose}>返回音乐库</Button>
      </View>
    );
  return (
    <View style={{ flex: 1 }}>
      <View
        style={[
          { flex: 1, paddingHorizontal: 28 },
          landscape
            ? { flexDirection: "row", gap: 30 }
            : { justifyContent: "space-between" },
        ]}
      >
        <View
          onLayout={(event) => setArtHeight(event.nativeEvent.layout.height)}
          style={[
            {
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              minHeight: 150,
            },
            landscape && { flex: 0, width: (width - 86) * 0.46 },
            vinyl && !landscape && { marginHorizontal: -20 },
          ]}
        >
          {prefs.player === "vinyl" ? (
            <View style={{ transform: [{ translateY: -recordLift }] }}>
              <Record
                track={current}
                material={prefs.record}
                speed={prefs.recordSpeed}
                stylusLight={prefs.stylusLight}
                tonearmStyle={prefs.tonearmStyle}
                cartridgeColor={prefs.cartridgeColor}
                size={artSize}
                playing={status.playing}
                progress={
                  status.currentTime /
                  (status.duration || current.duration || 1)
                }
              />
            </View>
          ) : prefs.player === "cover" ? (
            <Cover
              track={current}
              size={artSize}
              style={{
                borderRadius: 12,
                shadowColor: "#000",
                shadowOpacity: 0.2,
                shadowRadius: 20,
              }}
            />
          ) : (
            <View style={{ height: artSize }} />
          )}
        </View>
        <View
          style={[
            landscape ? { flex: 1, minWidth: 0, justifyContent: "center" } : {},
          ]}
        >
          <View style={[s.row, { marginTop: landscape ? 0 : vinyl ? 8 : 16 }]}>
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={2}
                style={[
                  s.songTitle,
                  compact && { fontSize: 25, lineHeight: 30 },
                  vinyl && !compact && { fontSize: 28, lineHeight: 34 },
                ]}
              >
                {current.title}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  s.artist,
                  (compact || vinyl) && { fontSize: 14, marginTop: 4 },
                ]}
              >
                {current.artist}
                {current.album ? (
                  <Text style={s.playerAlbumMeta}> · {current.album}</Text>
                ) : null}
              </Text>
            </View>
            <Action
              icon="heart"
              label={current.favorite ? "取消喜欢" : "喜欢这首歌"}
              selected={current.favorite}
              onPress={() => favorite(current)}
              color={current.favorite ? "#f0c1ab" : "#fff"}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="查看音频文件信息"
            onPress={onDetails}
            style={[
              s.quality,
              { minHeight: 32 },
              (compact || vinyl) && { marginTop: 4, minHeight: 28 },
            ]}
          >
            <Text style={s.qualityTag}>{current.format}</Text>
            <Text style={s.qualityText}>
              {[
                current.bits ? `${current.bits} bit` : null,
                current.sampleRate ? `${current.sampleRate / 1000} kHz` : null,
              ]
                .filter(Boolean)
                .join(" / ") || "本地音频"}
            </Text>
            <Text style={s.qualityText}>
              {current.format.toUpperCase() === "DSF" && supportsDsf
                ? "软解 → PCM ›"
                : "源文件 ›"}
            </Text>
          </Pressable>
          <Pressable
            onPress={onLyrics}
            accessibilityLabel="查看完整歌词"
            style={{
              alignItems: "center",
              paddingVertical: compact || vinyl ? 6 : 20,
              minHeight: compact || vinyl ? 44 : 85,
            }}
          >
            <LyricLine
              key={`${current?.id}-${index}-current`}
              text={lines[Math.max(index, 0)]?.text || "此刻，专注聆听"}
              style={s.previewLine}
              centered
              active={animateLyrics}
            />
            {!(vinyl && !landscape && height < 740) && (
              <LyricLine
                key={`${current?.id}-${index}-next`}
                text={
                  lines[Math.max(index, 0) + 1]?.text ||
                  (lines.length ? "" : "暂无歌词")
                }
                style={s.previewNext}
                centered
                active={animateLyrics}
              />
            )}
          </Pressable>
          <PlaybackControls onQueue={onQueue} />
        </View>
      </View>
    </View>
  );
}
export function LyricsScreen({
  onQueue,
  animateLyrics = true,
}: {
  onQueue: () => void;
  animateLyrics?: boolean;
}) {
  const {
    current,
    status,
    seek,
    prefs,
    preferences,
    favorite,
    lyricOffset,
    setLyricOffset,
  } = useMusic();
  const [adjustLyrics, setAdjustLyrics] = useState(false);
  const lines = current?.lyrics || [];
  const active = currentLyric(lines, status.currentTime, lyricOffset);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null),
    positions = useRef<number[]>([]),
    dragged = useRef(0);
  useEffect(() => {
    if (active >= 0 && Date.now() - dragged.current > 3000)
      scroll.current?.scrollTo({
        y: Math.max(0, (positions.current[active] || 0) - 70),
        animated: true,
      });
  }, [active]);
  return (
    <View style={{ flex: 1 }}>
      <View
        style={[s.row, { paddingHorizontal: 28, paddingVertical: 12, gap: 14 }]}
      >
        <Cover track={current} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={s.trackTitle}>{current?.title}</Text>
          <Text style={[s.tiny, { color: "#ffffff90" }]}>
            {current?.artist} · {current?.album}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="切换歌词字号"
          onPress={() => preferences({ largeLyrics: !prefs.largeLyrics })}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: "Georgia", fontSize: 22, color: "#fff" }}>
            Aa
          </Text>
        </Pressable>
        {current && (
          <Action
            icon="heart"
            label="喜欢这首歌"
            selected={current.favorite}
            onPress={() => favorite(current)}
          />
        )}
      </View>
      <View style={{ paddingHorizontal: 28, paddingBottom: 6 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="调整本曲歌词同步"
          accessibilityValue={{ text: `${lyricOffset.toFixed(1)} 秒` }}
          onPress={() => setAdjustLyrics(!adjustLyrics)}
          style={{
            minHeight: 36,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Icon name="clock" size={16} color="#ffffffa0" />
          <Text style={{ color: "#ffffffa0", fontSize: 12 }}>
            歌词同步 ·{" "}
            {lyricOffset === 0
              ? "原始时间"
              : `${lyricOffset > 0 ? "提前" : "延后"} ${Math.abs(lyricOffset).toFixed(1)} 秒`}
          </Text>
        </Pressable>
        {adjustLyrics && (
          <View style={{ flexDirection: "row", gap: 8, paddingBottom: 8 }}>
            {(
              [
                [-0.2, "延后 0.2 秒"],
                [0, "重置偏移"],
                [0.2, "提前 0.2 秒"],
              ] as const
            ).map(([delta, label]) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={label}
                disabled={!lines.some((line) => line.time !== null)}
                onPress={() =>
                  void setLyricOffset(delta === 0 ? 0 : lyricOffset + delta)
                }
                style={{
                  flex: 1,
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor: "#ffffff15",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 12 }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <ScrollView
        ref={scroll}
        onScrollBeginDrag={() => {
          dragged.current = Date.now();
        }}
        contentContainerStyle={{
          paddingHorizontal: 30,
          paddingTop: 12,
          paddingBottom: 90,
        }}
        showsVerticalScrollIndicator={false}
      >
        {lines.length ? (
          lines.map((line, i) => (
            <Pressable
              key={`${current?.id}-${i}-${line.time}`}
              disabled={line.time === null || !status.isLoaded}
              onLayout={(e) => {
                positions.current[i] = e.nativeEvent.layout.y;
              }}
              onPress={() => {
                if (line.time !== null)
                  void seek(lyricSeekTime(line.time, lyricOffset));
              }}
              accessibilityLabel={
                line.time === null ? line.text : `播放到：${line.text}`
              }
            >
              <LyricLine
                text={line.text}
                active={animateLyrics && (line.time === null || i === active)}
                style={{
                  fontSize: prefs.largeLyrics ? 32 : 26,
                  fontWeight: "700",
                  lineHeight: prefs.largeLyrics ? 43 : 36,
                  paddingVertical: 10,
                  color:
                    line.time === null
                      ? "#ffffffe0"
                      : i === active
                        ? "#fff"
                        : i < active
                          ? "#ffffff80"
                          : "#ffffff40",
                }}
              />
            </Pressable>
          ))
        ) : (
          <View style={{ paddingTop: 60, gap: 14 }}>
            <Text
              style={{ fontSize: 28, color: "#ffffffbc", fontWeight: "600" }}
            >
              让音乐，自由流动。
            </Text>
            <Text style={s.playerCaption}>
              这首歌暂时没有歌词。支持内嵌歌词与同名 LRC。
            </Text>
          </View>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: 28 }}>
        <PlaybackControls onQueue={onQueue} />
      </View>
    </View>
  );
}
export function SettingsScreen({
  onBack,
  onSources,
  initialSection = "root",
}: {
  onBack: () => void;
  onSources: () => void;
  initialSection?: SettingsSection;
}) {
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const title = settingsTitles[section];
  // Submenus consume Android Back before the surrounding library screen does.
  useEffect(() => {
    if (section === "root") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        setSection("root");
        return true;
      },
    );
    return () => subscription.remove();
  }, [section]);
  return (
    <View style={{ flex: 1 }}>
      <View style={[s.row, { paddingHorizontal: 24, paddingTop: 16 }]}>
        <Action
          icon="back"
          label={section === "root" ? "返回音乐库" : "返回设置"}
          onPress={section === "root" ? onBack : () => setSection("root")}
        />
        <Text style={s.screenTitle}>{title}</Text>
        <View style={{ width: 46 }} />
      </View>
      <ScrollView
        key={section}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: 24, paddingBottom: 50 }}
      >
        {section === "root" ? (
          <SettingsHome open={setSection} onSources={onSources} />
        ) : section === "appearance" ? (
          <AppearanceSettings />
        ) : section === "playback" ? (
          <>
            <PlaybackSettings />
            <AdvancedAudioSettings />
          </>
        ) : (
          <SettingsInfo section={section} />
        )}
      </ScrollView>
    </View>
  );
}
function AppearanceSettings() {
  const { prefs, preferences } = useMusic();
  return (
    <>
      <Text style={s.section}>主页布局</Text>
      <View style={s.options}>
        {(
          [
            ["gallery", "唱片馆", "封面优先"],
            ["library", "曲库", "分类浏览"],
            ["quiet", "静听", "专注聆听"],
          ] as [HomeStyle, string, string][]
        ).map(([key, name, note]) => (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityState={{ selected: prefs.home === key }}
            onPress={() => preferences({ home: key })}
            style={[s.option, prefs.home === key && s.optionSelected]}
          >
            <Icon
              name={
                key === "gallery"
                  ? "library"
                  : key === "quiet"
                    ? "disc"
                    : "queue"
              }
              color={p.gold}
            />
            <Text style={[s.trackTitle, { marginTop: 12 }]}>{name}</Text>
            <Text style={s.tiny}>{note}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.section}>唱片样式</Text>
      <Text style={[s.subtitle, { marginBottom: 15 }]}>
        为旋转的音乐，选一种质感。
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {(Object.keys(materials) as RecordStyle[]).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityLabel={materials[key].name}
            accessibilityState={{ selected: prefs.record === key }}
            onPress={() => preferences({ record: key })}
            style={[s.material, prefs.record === key && s.optionSelected]}
          >
            <Record material={key} size={68} mini />
            <Text style={[s.trackTitle, { fontSize: 12, marginTop: 12 }]}>
              {materials[key].name}
            </Text>
            {prefs.record === key && (
              <View style={{ position: "absolute", right: 7, top: 7 }}>
                <Icon name="check" size={14} color={p.gold} />
              </View>
            )}
          </Pressable>
        ))}
      </View>
      <Text style={s.section}>唱臂风格</Text>
      <Text style={[s.subtitle, { marginBottom: 15 }]}>
        与唱片材质自由搭配，选择后自动保存。
      </Text>
      <View style={s.options}>
        {(Object.keys(tonearmStyles) as TonearmStyle[]).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityLabel={`唱臂风格：${tonearmStyles[key].name}`}
            accessibilityState={{ selected: prefs.tonearmStyle === key }}
            onPress={() => preferences({ tonearmStyle: key })}
            style={[s.option, prefs.tonearmStyle === key && s.optionSelected]}
          >
            <View
              style={{
                height: 132,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TonearmSprite
                arm={key}
                color={prefs.cartridgeColor}
                size={132}
              />
            </View>
            <Text style={[s.trackTitle, { marginTop: 10 }]}>
              {tonearmStyles[key].name}
            </Text>
            <Text style={[s.tiny, { marginTop: 5 }]}>
              {tonearmStyles[key].description}
            </Text>
            {prefs.tonearmStyle === key && (
              <View style={{ position: "absolute", right: 10, top: 10 }}>
                <Icon name="check" size={14} color={p.gold} />
              </View>
            )}
          </Pressable>
        ))}
      </View>
      <Text style={s.section}>唱头颜色</Text>
      <CartridgeColorOptions
        selected={prefs.cartridgeColor}
        onChange={(cartridgeColor) => preferences({ cartridgeColor })}
        accent={p.gold}
      />
      <Text style={s.section}>黑胶转速</Text>
      <Text style={[s.subtitle, { marginBottom: 15 }]}>
        仅调整唱片动画，歌曲按原速播放。选择后自动保存。
      </Text>
      <View style={s.options}>
        {(Object.keys(recordSpeeds) as RecordSpeed[]).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityLabel={`黑胶转速：${recordSpeeds[key].name}`}
            accessibilityState={{ selected: prefs.recordSpeed === key }}
            onPress={() => preferences({ recordSpeed: key })}
            style={[s.option, prefs.recordSpeed === key && s.optionSelected]}
          >
            <Text style={s.trackTitle}>{recordSpeeds[key].name}</Text>
            <Text style={s.tiny}>
              {key === "standard"
                ? "默认节奏"
                : key === "slow"
                  ? "舒缓转动"
                  : "轻快转动"}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.section}>唱头灯光</Text>
      <Text style={[s.subtitle, { marginBottom: 15 }]}>
        播放时在针尖亮起，暂停后渐隐。
      </Text>
      <View style={[s.options, { flexWrap: "wrap" }]}>
        {(Object.keys(stylusLights) as StylusLight[]).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityLabel={`唱头灯光：${stylusLights[key].name}`}
            accessibilityState={{ selected: prefs.stylusLight === key }}
            onPress={() => preferences({ stylusLight: key })}
            style={[
              s.option,
              {
                minWidth: "40%",
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              },
              prefs.stylusLight === key && s.optionSelected,
            ]}
          >
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor:
                  key === "off" ? "transparent" : stylusLights[key].color,
                borderWidth: 1,
                borderColor: stylusLights[key].color,
              }}
            />
            <Text style={s.trackTitle}>{stylusLights[key].name}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}
function PlaybackSettings() {
  const { prefs, preferences, setPlaybackMode } = useMusic();
  return (
    <>
      <Text style={s.section}>播放方式</Text>
      <View style={s.options}>
        {(Object.keys(playbackModes) as PlaybackMode[]).map((mode) => (
          <Pressable
            key={mode}
            accessibilityRole="radio"
            accessibilityState={{ selected: prefs.playbackMode === mode }}
            onPress={() => setPlaybackMode(mode)}
            style={[s.option, prefs.playbackMode === mode && s.optionSelected]}
          >
            <Icon name={playbackModes[mode].icon} color={p.gold} />
            <Text style={[s.trackTitle, { marginTop: 12, fontSize: 13 }]}>
              {playbackModes[mode].name}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.section}>歌词字号</Text>
      <View style={s.options}>
        {[false, true].map((large) => (
          <Pressable
            key={String(large)}
            accessibilityRole="radio"
            accessibilityLabel={`歌词字号：${large ? "大字" : "标准"}`}
            accessibilityState={{ selected: prefs.largeLyrics === large }}
            onPress={() => preferences({ largeLyrics: large })}
            style={[s.option, prefs.largeLyrics === large && s.optionSelected]}
          >
            <Text style={[s.trackTitle, { fontSize: large ? 22 : 16 }]}>
              {large ? "大字" : "标准"}
            </Text>
            <Text style={[s.tiny, { marginTop: 6 }]}>
              {large ? "更轻松阅读" : "均衡显示"}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}
export const SourcesScreen = FileScanScreen;
export function DetailsScreen({ onBack }: { onBack: () => void }) {
  const { current } = useMusic();
  if (!current) return null;
  const source = sourceStatus(current.sourceId);
  let location = current.uri;
  try {
    location = trackUri(current);
  } catch {}
  const details = trackDetails(current, source, location);
  const rows = [
    ["歌曲", current.title],
    ["艺术家", current.artist],
    ["专辑", current.album],
    ...details.tags,
    ...details.audio,
    ...details.file,
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
      <View style={s.row}>
        <Action icon="back" label="返回播放页面" onPress={onBack} />
        <Text style={s.screenTitle}>音频文件信息</Text>
        <View style={{ width: 46 }} />
      </View>
      <View style={{ alignItems: "center", paddingVertical: 24 }}>
        <Cover track={current} size={140} />
      </View>
      <Text style={[s.subtitle, { marginBottom: 16 }]}>
        以下信息直接读取自音频文件。采样率和位深为源文件参数。
      </Text>
      {rows.map(([label, value]) => (
        <View key={label} style={[s.settingRow, { alignItems: "flex-start" }]}>
          <Text style={[s.tiny, { width: 90, marginTop: 0 }]}>{label}</Text>
          <Text
            selectable
            style={{ flex: 1, color: p.text, fontSize: 13, lineHeight: 20 }}
          >
            {value}
          </Text>
        </View>
      ))}
      {current.warning && (
        <Text style={[s.subtitle, { color: "#ddac96", marginTop: 18 }]}>
          标签读取提示：{current.warning}
        </Text>
      )}
    </ScrollView>
  );
}
export const s = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 18,
  },
  eyebrow: { fontSize: 8, color: p.muted, letterSpacing: 2.3, marginBottom: 9 },
  heading: {
    color: p.text,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  stats: {
    flexDirection: "row",
    gap: 34,
    marginVertical: 14,
    marginBottom: 24,
  },
  statNumber: {
    fontSize: 25,
    color: p.text,
    fontWeight: "600",
    letterSpacing: 1,
  },
  tiny: { fontSize: 11, color: p.muted, marginTop: 5, lineHeight: 16 },
  hero: { height: 225, borderRadius: 13, overflow: "hidden" },
  heroContent: { flex: 1, padding: 22, justifyContent: "space-between" },
  heroCaption: { fontSize: 11, color: "#ffffffe0" },
  heroTitle: { fontSize: 30, fontWeight: "600", lineHeight: 43, color: "#fff" },
  heroPlay: {
    backgroundColor: "#eee9dd",
    width: 39,
    height: 39,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tabs: { flexDirection: "row", gap: 24 },
  tab: { paddingBottom: 12, minHeight: 36 },
  tabActive: { borderBottomColor: p.gold, borderBottomWidth: 2 },
  search: {
    backgroundColor: p.surface,
    color: p.text,
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  cardTitle: { color: p.text, fontSize: 14, fontWeight: "600", marginTop: 10 },
  trackRow: {
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
    paddingVertical: 8,
    borderBottomColor: p.line,
    borderBottomWidth: 1,
  },
  trackTitle: { color: p.text, fontSize: 15, fontWeight: "600" },
  libraryDock: { position: "absolute", left: 12, right: 12, gap: 4 },
  nav: { flexDirection: "row", alignItems: "center", gap: 4 },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 44,
  },
  emptyHero: {
    borderRadius: 16,
    padding: 24,
    backgroundColor: "#2e302e",
    marginTop: 10,
  },
  subtitle: { color: p.muted, fontSize: 13, lineHeight: 22 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20 },
  playerTop: {
    height: 62,
    flexShrink: 0,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  playerCaption: { fontSize: 10, color: "#ffffff90", letterSpacing: 1 },
  playerAlbum: { fontSize: 12, color: "#fff", fontWeight: "600", marginTop: 6 },
  playerStyleDots: {
    flex: 1,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  playerStyleDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#fff5e85c",
  },
  playerStyleDotActive: { width: 14, backgroundColor: "#fff5e8eb" },
  songTitle: { fontSize: 30, fontWeight: "700", color: "#fff", lineHeight: 38 },
  artist: { fontSize: 17, color: "#ffffffa8", marginTop: 7 },
  playerAlbumMeta: { color: "#ffffff70" },
  quality: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    marginTop: 14,
  },
  qualityTag: {
    fontSize: 9,
    color: "#ffffffe0",
    borderColor: "#ffffff70",
    borderWidth: 0.5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  qualityText: { fontSize: 10, color: "#ffffff90" },
  previewLine: { fontSize: 14, color: "#fffffff0", fontWeight: "600" },
  previewNext: { fontSize: 12, color: "#ffffff65", marginTop: 8 },
  screenTitle: { fontSize: 19, color: p.text, fontWeight: "600" },
  section: {
    color: p.gold,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 32,
    marginBottom: 15,
    letterSpacing: 1,
  },
  settingRow: {
    paddingVertical: 19,
    borderBottomWidth: 1,
    borderBottomColor: p.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  options: { flexDirection: "row", gap: 10 },
  option: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.line,
    padding: 15,
    backgroundColor: "#ffffff04",
  },
  optionSelected: { borderColor: p.gold, backgroundColor: "#d5b78212" },
  material: {
    width: "30%",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    borderColor: p.line,
    borderWidth: 1,
  },
  sourceCard: { padding: 21, borderRadius: 15, backgroundColor: p.surface },
});
