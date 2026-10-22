import React, {
  useEffect,
  useCallback,
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
  AccessibilityInfo,
  Animated,
  ActivityIndicator,
  AppState,
  type GestureResponderHandlers,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurTargetView } from "expo-blur";
import {
  useMusic,
  usePlaybackProgress,
  useLyricIndex,
} from "../services/store";
import { canPlay, supportsDsf } from "../services/playbackSupport";
import { sourceStatus, trackUri } from "../services/files";
import {
  recordSpeeds,
  stylusLights,
  type StylusLight,
  playbackModes,
  type PlaybackMode,
  type Track,
  type LyricLine as LyricData,
  type HomeStyle,
  type RecordStyle,
  type RecordSpeed,
  type TonearmStyle,
} from "../core/types";
import { useCatalogPage } from "../services/useCatalogPage";
import { TrackVersions } from "./TrackVersions";
import { CartridgeColorOptions } from "./CartridgeColorOptions";
import { lyricSeekTime } from "../core/lyrics";
import { FocusedLyricLine } from "./FocusedLyricLine";
import {
  lyricMetrics,
  lyricFocus,
  lyricIdleDelay,
} from "../core/lyricPresentation";
import { FormatTag } from "./FormatTag";
import { trackDetails } from "../core/trackDetails";
import {
  Action,
  Button,
  MiniPlayer,
  PlaybackControls,
  navigationHeader,
} from "./components";
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
  active = true,
  onPlayer,
  onSettings,
  onQueue,
}: {
  active?: boolean;
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
    playCollection,
    sources,
  } = useMusic();
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(false),
    [tab, setTab] = useState<"albums" | "tracks" | "artists" | "folders">(
      "albums",
    ),
    [filter, setFilter] = useState(""),
    [favorites, setFavorites] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("");
  const [versionTrack, setVersionTrack] = useState<Track | null>(null);
  const [filterTitle, setFilterTitle] = useState("");
  const page = useCatalogPage({
    query,
    favorites,
    sourceIds: sourceFilter ? [sourceFilter] : undefined,
    kind: filter ? "tracks" : tab,
    collection: filter || undefined,
    collectionKind: tab === "tracks" ? undefined : tab,
  });
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
  const grouped = tab !== "tracks" && !filter;
  const groupValue = (t: Track) =>
    t.collectionKey ||
    (tab === "artists"
      ? t.artist
      : tab === "albums"
        ? t.releaseKey || t.album
        : `${t.sourceId}\u0000${t.path.split("/").slice(0, -1).join("/")}`);
  const shown = mix
    ? mix.ids
        .map((id) => tracks.find((t) => t.id === id))
        .filter((t): t is Track => !!t)
    : page.items;
  const rows = shown;
  const total = mix ? shown.length : page.total;
  const layout = tab === "artists" ? prefs.artistLayout : prefs.albumLayout;
  const grid = grouped && (tab === "folders" || layout === "cards");
  const choose = (track: Track) => {
    if (grouped) {
      setFilter(groupValue(track));
      setFilterTitle(
        tab === "albums"
          ? track.album
          : tab === "artists"
            ? track.artist
            : track.collectionKey?.split("\u0000")[1] || "音乐目录",
      );
    } else {
      if (mix) play(track, shown);
      else
        void playCollection(track, {
          query,
          favorites,
          sourceIds: sourceFilter ? [sourceFilter] : undefined,
          collection: filter || undefined,
          collectionKind: tab === "tracks" ? undefined : tab,
        });
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
      {(tracks.length > 0 || page.total > 0) && (
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
      {!tracks.length &&
        !page.total &&
        !page.loading &&
        !query &&
        !favorites && (
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
      {(sourceFilter ||
        sources.filter((source) => source.enabled !== false).length > 1) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
        >
          {[
            { id: "", name: "全部来源" },
            ...sources.filter((source) => source.enabled !== false),
          ].map((source) => (
            <Pressable
              key={source.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: sourceFilter === source.id }}
              onPress={() => {
                setSourceFilter(source.id);
                setMix(null);
              }}
              style={{
                minHeight: 36,
                paddingHorizontal: 14,
                borderRadius: 18,
                justifyContent: "center",
                backgroundColor:
                  sourceFilter === source.id ? "#d5b78222" : "#ffffff07",
              }}
            >
              <Text
                style={{
                  color: sourceFilter === source.id ? p.gold : p.muted,
                  fontSize: 12,
                }}
              >
                {source.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
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
        {grouped && tab !== "folders" && (
          <Action
            icon={layout === "cards" ? "list" : "grid"}
            label={`${tab === "albums" ? "专辑" : "艺术家"}切换为${layout === "cards" ? "列表" : "卡片"}`}
            size={20}
            color={p.muted}
            style={{ marginLeft: "auto", marginRight: -12 }}
            onPress={() =>
              void preferences(
                tab === "albums"
                  ? { albumLayout: layout === "cards" ? "list" : "cards" }
                  : { artistLayout: layout === "cards" ? "list" : "cards" },
              )
            }
          />
        )}
      </View>
      {(tracks.length > 0 || page.total > 0) && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 4,
            minHeight: 44,
          }}
        >
          {mix ? (
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
                ? tab === "albums"
                  ? "全部专辑"
                  : tab === "artists"
                    ? "全部艺术家"
                    : "音乐目录"
                : filter
                  ? "歌曲列表"
                  : favorites
                    ? "喜欢的音乐"
                    : "全部歌曲"}
            </Text>
          )}
          <Text style={{ color: p.muted, fontSize: 11, letterSpacing: 0.4 }}>
            {grouped
              ? `${total} ${tab === "albums" ? "张专辑" : tab === "artists" ? "位艺术家" : "个文件夹"}`
              : `${total} 首歌曲`}
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
            {filterTitle} · {total} 首
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
          onEndReached={() => {
            if (!mix) void page.loadMore();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            page.loading ? (
              <ActivityIndicator color={p.gold} style={{ padding: 24 }} />
            ) : page.error ? (
              <Text style={s.subtitle}>{page.error}</Text>
            ) : undefined
          }
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={5}
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
              {mix && !shown.length
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
                tracks={[item]}
                count={item.collectionCount}
                title={
                  tab === "albums"
                    ? item.album
                    : tab === "artists"
                      ? item.artist
                      : item.collectionKey?.split("\u0000")[1] || "音乐目录"
                }
                layout={grid ? "cards" : "list"}
                width={(width - 48 - 14 * (columns - 1)) / columns}
                onPress={() => choose(item)}
              />
            ) : (
              <View style={s.trackRow}>
                <Pressable
                  onPress={() => choose(item)}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                  }}
                  accessibilityRole="button"
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
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 3,
                      }}
                    >
                      {item.available && <FormatTag format={item.format} />}
                      <Text
                        numberOfLines={1}
                        style={[s.tiny, { flexShrink: 1, marginTop: 0 }]}
                      >
                        {item.artist}
                        {!item.available
                          ? " · 文件不可用"
                          : !canPlay(item)
                            ? " · 待解码支持"
                            : ""}
                      </Text>
                    </View>
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
                {(item.copyCount || 0) > 1 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`选择 ${item.title} 的来源`}
                    onPress={() => setVersionTrack(item)}
                    style={{
                      minHeight: 44,
                      minWidth: 55,
                      paddingHorizontal: 8,
                      borderRadius: 12,
                      backgroundColor: "#d5b7820b",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: p.gold, fontSize: 10 }}>
                      {item.copyCount} 个来源
                    </Text>
                  </Pressable>
                )}
              </View>
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
          active={active}
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
      <TrackVersions
        track={versionTrack}
        onClose={() => setVersionTrack(null)}
        onPlay={(track) => {
          play(
            track,
            shown.map((t) => (t.songKey === track.songKey ? track : t)),
          );
          onPlayer();
        }}
      />
    </View>
  );
}
const emptyLyrics: Track["lyrics"] = [];
function PlayingRecord(
  props: Omit<React.ComponentProps<typeof Record>, "playing" | "progress">,
) {
  const status = usePlaybackProgress();
  return (
    <Record
      {...props}
      playing={status.playing}
      progress={
        status.currentTime / (status.duration || props.track?.duration || 1)
      }
    />
  );
}
function LyricPreview({ showNext }: { showNext: boolean }) {
  const { current, lyricOffset } = useMusic();
  const lines = current?.lyrics || emptyLyrics;
  const index = useLyricIndex(lines, lyricOffset);
  return (
    <View style={{ width: "100%" }}>
      <Text
        testID="lyric-preview"
        style={[s.previewLine, { textAlign: "center" }]}
      >
        {lines[Math.max(index, 0)]?.text || "此刻，专注聆听"}
      </Text>
      {showNext && (
        <Text style={[s.previewNext, { textAlign: "center" }]}>
          {lines[Math.max(index, 0) + 1]?.text ||
            (lines.length ? "" : "暂无歌词")}
        </Text>
      )}
    </View>
  );
}

export function PlayerScreen({
  onClose,
  onLyrics,
  onQueue,
  onDetails,
  dismissPanHandlers,
}: {
  onClose: () => void;
  onLyrics: () => void;
  onQueue: () => void;
  onDetails: () => void;
  dismissPanHandlers?: GestureResponderHandlers;
}) {
  const { current } = useMusic();
  if (!current)
    return (
      <View style={s.center}>
        <Text style={s.subtitle}>先导入一首音乐</Text>
        <Button onPress={onClose}>返回音乐库</Button>
      </View>
    );
  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <View style={{ flex: 1, paddingHorizontal: 28 }} {...dismissPanHandlers}>
        <PlayerTrackContent
          current={current}
          onLyrics={onLyrics}
          onDetails={onDetails}
        />
      </View>
      <View style={{ paddingHorizontal: 28, backgroundColor: "transparent" }}>
        <PlaybackControls onQueue={onQueue} />
      </View>
    </View>
  );
}

function PlayerTrackContent({
  current,
  onLyrics,
  onDetails,
}: {
  current: Track;
  onLyrics: () => void;
  onDetails: () => void;
}) {
  const { prefs, favorite } = useMusic();
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
    (vinyl ? 0.87 : 1) *
    Math.min(
      preferredArtSize,
      artHeight
        ? prefs.player === "vinyl"
          ? (artHeight - 4) / 1.06
          : (artHeight - 14) / 1.11
        : preferredArtSize,
    );
  const recordLift = Math.min(landscape ? 6 : 12, artHeight * 0.03);
  const infoLift =
    landscape || prefs.player === "immersive"
      ? 0
      : height < 620
        ? 10
        : compact
          ? 16
          : 24;
  return (
    <View
      style={[
        { flex: 1 },
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
            <PlayingRecord
              track={current}
              material={prefs.record}
              speed={prefs.recordSpeed}
              stylusLight={prefs.stylusLight}
              tonearmStyle={prefs.tonearmStyle}
              cartridgeColor={prefs.cartridgeColor}
              size={artSize}
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
        <View style={{ marginTop: -infoLift, paddingBottom: infoLift }}>
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
            <FormatTag format={current.format} />
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
            <LyricPreview showNext={!(vinyl && !landscape && height < 740)} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
export function LyricsScreen({
  onQueue,
  visible = true,
}: {
  onQueue: () => void;
  visible?: boolean;
}) {
  const {
    current,
    seek,
    prefs,
    preferences,
    favorite,
    lyricOffset,
    setLyricOffset,
  } = useMusic();
  const { status } = useMusic();
  const [adjustLyrics, setAdjustLyrics] = useState(false);
  const lines = current?.lyrics || emptyLyrics;
  const active = useLyricIndex(lines, lyricOffset);
  const { width, fontScale } = useWindowDimensions();
  const {
    fontSize: lyricFontSize,
    lineHeight: lyricLineHeight,
    minRowHeight,
  } = lyricMetrics(width, fontScale, prefs.largeLyrics);
  const scroll = useRef<FlatList<LyricData>>(null);
  const followTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const followAttempts = useRef(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [controlsHeight, setControlsHeight] = useState(140);
  const [idle, setIdle] = useState(false);
  const [interaction, setInteraction] = useState(0);
  const [browsing, setBrowsing] = useState(false);
  const browseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const wakeTouch = useRef(false);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [screenReader, setScreenReader] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [controlsOpacity] = useState(() => new Animated.Value(1));
  const canImmerse =
    visible &&
    status.playing &&
    lines.length > 0 &&
    !adjustLyrics &&
    !browsing &&
    !screenReader &&
    foreground;
  const immersive = idle && canImmerse;
  const topPadding = 28;
  const anchor = 72;
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (mounted) setScreenReader(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const reader = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setScreenReader,
    );
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    const app = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
      setIdle(false);
    });
    return () => {
      mounted = false;
      reader.remove();
      motion.remove();
      app.remove();
      clearTimeout(browseTimer.current);
      clearTimeout(followTimer.current);
    };
  }, []);
  useEffect(() => {
    // A new page/song/playback session always starts with visible controls.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdle(false);
    if (!canImmerse) return;
    const timer = setTimeout(() => setIdle(true), lyricIdleDelay);
    return () => clearTimeout(timer);
  }, [canImmerse, interaction, current?.id]);
  useEffect(() => {
    const animation = Animated.timing(controlsOpacity, {
      toValue: immersive ? 0 : 1,
      duration: reduced ? 0 : 260,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [immersive, controlsOpacity, reduced]);
  const followCurrent = useCallback(() => {
    if (visible && !browsing && active >= 0 && viewportHeight > 0)
      scroll.current?.scrollToIndex({
        index: active,
        viewPosition: 0,
        viewOffset: anchor,
        animated: !reduced,
      });
  }, [active, visible, browsing, viewportHeight, reduced]);
  useEffect(() => {
    followAttempts.current = 0;
    followCurrent();
    return () => clearTimeout(followTimer.current);
  }, [followCurrent, width, lyricFontSize, fontScale, current?.id]);
  const interact = () => {
    setIdle(false);
    setInteraction((value) => value + 1);
  };
  const browseEnd = () => {
    clearTimeout(browseTimer.current);
    browseTimer.current = setTimeout(() => setBrowsing(false), 4000);
  };
  return (
    <View
      style={{ flex: 1 }}
      testID={immersive ? "lyrics-immersive" : "lyrics-standard"}
      onTouchStart={() => {
        wakeTouch.current = immersive;
        interact();
      }}
    >
      <View
        style={[s.row, { paddingHorizontal: 28, paddingVertical: 12, gap: 14 }]}
      >
        <Cover track={current} size={48} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={s.trackTitle}>
            {current?.title}
          </Text>
          <Text numberOfLines={1} style={[s.tiny, { color: "#ffffff90" }]}>
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
      <Animated.View
        style={{
          paddingHorizontal: 28,
          paddingBottom: 6,
          opacity: controlsOpacity,
        }}
        pointerEvents={immersive ? "none" : "auto"}
        accessibilityElementsHidden={immersive}
        importantForAccessibility={immersive ? "no-hide-descendants" : "auto"}
      >
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
      </Animated.View>
      <View
        style={{ flex: 1, marginBottom: immersive ? 0 : controlsHeight }}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      >
        <FlatList
          ref={scroll}
          key={`${current?.id}-${width}-${lyricFontSize}-${fontScale}`}
          testID="lyrics-list"
          data={lines}
          extraData={`${active}-${fontScale}-${status.isLoaded}-${lyricOffset}-${browsing}-${screenReader}-${reduced}`}
          keyExtractor={(_, index) => `${current?.id}-${index}`}
          initialNumToRender={12}
          maxToRenderPerBatch={6}
          windowSize={5}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            if (
              !visible ||
              browsing ||
              index !== active ||
              followAttempts.current++ >= 5
            )
              return;
            // Let virtualization measure the destination before using its actual position.
            scroll.current?.scrollToOffset({
              offset: averageItemLength * index,
              animated: false,
            });
            clearTimeout(followTimer.current);
            followTimer.current = setTimeout(followCurrent, 120);
          }}
          onContentSizeChange={followCurrent}
          onScrollBeginDrag={() => {
            clearTimeout(browseTimer.current);
            setBrowsing(true);
            interact();
          }}
          onScrollEndDrag={browseEnd}
          onMomentumScrollBegin={() => clearTimeout(browseTimer.current)}
          onMomentumScrollEnd={browseEnd}
          contentContainerStyle={{
            paddingHorizontal: 30,
            paddingTop: topPadding,
            paddingBottom: Math.max(40, viewportHeight - anchor - minRowHeight),
          }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: line, index: i }) => {
            const timed = line.time !== null;
            const distance = active < 0 ? Infinity : Math.abs(i - active);
            const focus = lyricFocus(distance, timed, browsing, screenReader);
            return (
              <Pressable
                disabled={line.time === null || !status.isLoaded}
                style={{ minHeight: minRowHeight, paddingVertical: 15 }}
                accessibilityState={{ selected: timed && i === active }}
                onPress={() => {
                  if (wakeTouch.current) return;
                  if (line.time !== null) {
                    clearTimeout(browseTimer.current);
                    setBrowsing(false);
                    void seek(lyricSeekTime(line.time, lyricOffset));
                  }
                }}
                accessibilityLabel={
                  line.time === null ? line.text : `播放到：${line.text}`
                }
              >
                <FocusedLyricLine
                  text={line.text}
                  fontSize={lyricFontSize}
                  lineHeight={lyricLineHeight}
                  fontScale={fontScale}
                  blur={focus.blur}
                  opacity={focus.opacity}
                  reduced={reduced}
                />
              </Pressable>
            );
          }}
          ListEmptyComponent={
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
          }
        />
      </View>
      <Animated.View
        pointerEvents={immersive ? "none" : "auto"}
        accessibilityElementsHidden={immersive}
        importantForAccessibility={immersive ? "no-hide-descendants" : "auto"}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 28,
          opacity: controlsOpacity,
        }}
        onLayout={(event) => setControlsHeight(event.nativeEvent.layout.height)}
      >
        <PlaybackControls onQueue={onQueue} />
      </Animated.View>
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
      <View style={navigationHeader}>
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
      <View style={[navigationHeader, { marginHorizontal: -24 }]}>
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
  tabs: { flexDirection: "row", alignItems: "center", gap: 16 },
  tab: { justifyContent: "center", minHeight: 46 },
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
