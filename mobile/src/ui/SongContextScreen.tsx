import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { Track } from "../core/types";
import { canPlay, supportsDsf } from "../services/playbackSupport";
import { useMusic } from "../services/store";
import { PlaybackControls } from "./components";
import { trackDetails, type DetailRow } from "../core/trackDetails";
import { albumKey, artistAlbums } from "../core/artistAlbums";
import { relatedSelection } from "../core/discovery";
import { sourceStatus, trackUri } from "../services/files";
import { ArtistAvatar, Cover, Icon } from "./visuals";

type Collection =
  | { kind: "artist" }
  | { kind: "album"; key: string; from: "artist" | "details" }
  | null;

export function SongContextScreen({
  onPlay,
  onQueue,
}: {
  onPlay: () => void;
  onQueue: () => void;
}) {
  const { current, tracks, play, status, listeningProfile } = useMusic();
  const [collection, setCollection] = useState<Collection>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const [previousTrack, setPreviousTrack] = useState(current?.id);
  if (previousTrack !== current?.id) {
    setPreviousTrack(current?.id);
    setCollection(null);
  }
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [current?.id]);
  const { artistTracks, albums, related } = useMemo(() => {
    if (!current) return { artistTracks: [], albums: [], related: [] };
    const artistTracks = tracks.filter((t) => t.artist === current.artist);
    const albums = artistAlbums(tracks, current);
    const related = relatedSelection(
      tracks.filter(canPlay),
      current,
      listeningProfile,
    ).slice(0, 4);
    return { artistTracks, albums, related };
  }, [current, tracks, listeningProfile]);
  if (!current)
    return (
      <View style={styles.empty}>
        <Text style={styles.muted}>导入音乐后，这里会展示歌曲详情。</Text>
      </View>
    );
  let uri = current.uri;
  try {
    uri = trackUri(current);
  } catch {}
  const details = trackDetails(current, sourceStatus(current.sourceId), uri);
  const artistArtwork =
    current.artistArtwork ||
    artistTracks.find((track) => track.artistArtwork)?.artistArtwork;
  const currentAlbum = albums.find((album) => album.key === albumKey(current));
  const selectedAlbum =
    collection?.kind === "album"
      ? albums.find((album) => album.key === collection.key)
      : undefined;
  const list =
    collection?.kind === "album" ? selectedAlbum?.tracks || [] : related;
  const openCollection = (next: Collection) => {
    setCollection(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const choose = (track: Track) => {
    play(track, list);
    if (canPlay(track)) onPlay();
  };
  const renderList = () => (
    <View>
      <View style={[styles.sectionHeader, landscape && { marginTop: 0 }]}>
        <Text style={styles.sectionTitle}>
          {collection?.kind === "album" ? "专辑曲目" : "猜你喜欢"}
        </Text>
        {collection ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              collection.kind === "album" && collection.from === "artist"
                ? "返回歌手专辑"
                : "返回歌曲信息"
            }
            onPress={() =>
              openCollection(
                collection.kind === "album" && collection.from === "artist"
                  ? { kind: "artist" }
                  : null,
              )
            }
            style={styles.back}
          >
            <Text style={styles.caption}>
              {collection.kind === "album" && collection.from === "artist"
                ? "返回歌手专辑"
                : "返回歌曲信息"}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.caption}>来自你的曲库</Text>
        )}
      </View>
      {selectedAlbum && (
        <View style={styles.albumSummary}>
          <Cover
            track={selectedAlbum.cover}
            size={48}
            style={{ borderRadius: 7 }}
          />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.trackTitle}>{selectedAlbum.title}</Text>
            <Text style={styles.caption}>
              {selectedAlbum.artist} · {selectedAlbum.tracks.length} 首
            </Text>
          </View>
        </View>
      )}
      {list.length ? (
        list.map((track) => (
          <Pressable
            key={track.id}
            accessibilityRole="button"
            accessibilityLabel={`播放 ${track.title}`}
            onPress={() => choose(track)}
            style={styles.track}
          >
            <Cover track={track} size={38} style={{ borderRadius: 6 }} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text numberOfLines={1} style={styles.trackTitle}>
                {track.title}
              </Text>
              <Text numberOfLines={1} style={styles.caption}>
                {track.artist} · {track.album}
              </Text>
            </View>
            <Icon
              name={
                track.id === current.id && status.playing ? "pause" : "play"
              }
              size={15}
              color="#eadbc6"
            />
          </Pressable>
        ))
      ) : (
        <Text style={styles.emptyText}>
          曲库里还没有更多歌曲，添加音乐后再来发现。
        </Text>
      )}
    </View>
  );
  const renderAlbums = (expanded = false) => (
    <View>
      <View style={[styles.sectionHeader, landscape && { marginTop: 0 }]}>
        <Text style={styles.sectionTitle}>歌手专辑</Text>
        {expanded ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="返回歌曲信息"
            onPress={() => openCollection(null)}
            style={styles.back}
          >
            <Text style={styles.caption}>返回歌曲信息</Text>
          </Pressable>
        ) : albums.length > 4 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="查看全部歌手专辑"
            onPress={() => openCollection({ kind: "artist" })}
            style={styles.back}
          >
            <Text style={styles.caption}>全部 {albums.length} 张 ›</Text>
          </Pressable>
        ) : (
          <Text style={styles.caption}>曲库收录 · {albums.length} 张</Text>
        )}
      </View>
      <View style={styles.albumGrid}>
        {(expanded ? albums : albums.slice(0, 4)).map((album) => (
          <Pressable
            key={album.key}
            accessibilityRole="button"
            accessibilityLabel={`打开专辑：${album.title}，${album.tracks.length} 首`}
            onPress={() =>
              openCollection({
                kind: "album",
                key: album.key,
                from: expanded ? "artist" : "details",
              })
            }
            style={styles.albumCard}
          >
            <View style={styles.albumArtwork}>
              <Cover track={album.cover} style={StyleSheet.absoluteFill} />
              <View style={styles.albumCount}>
                <Icon name="disc" size={11} color="#fff6e8" />
                <Text style={styles.albumCountText}>
                  {album.tracks.length} 首
                </Text>
              </View>
            </View>
            <Text numberOfLines={2} style={styles.albumTitle}>
              {album.title}
            </Text>
            <Text numberOfLines={1} style={styles.caption}>
              {album.artist}
            </Text>
          </Pressable>
        ))}
      </View>
      {!albums.length && (
        <Text style={styles.emptyText}>曲库里还没有这位歌手的专辑。</Text>
      )}
    </View>
  );
  return (
    <View style={styles.root}>
      <ScrollView
        ref={scroll}
        testID="song-details-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, landscape && styles.wide]}
      >
        <View style={landscape ? styles.column : undefined}>
          <View style={styles.hero}>
            <Cover track={current} size={64} style={{ borderRadius: 9 }} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text selectable style={styles.title}>
                {current.title}
              </Text>
              <Text selectable style={styles.muted}>
                {current.artist}
              </Text>
            </View>
          </View>
          <View style={styles.links}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`查看歌手：${current.artist}`}
              onPress={() => openCollection({ kind: "artist" })}
              style={styles.link}
            >
              <ArtistAvatar artwork={artistArtwork} name={current.artist} />
              <Text numberOfLines={2} style={styles.linkTitle}>
                <Text style={styles.linkLabel}>歌手 · </Text>
                {current.artist}
              </Text>
              <Text style={styles.caption}>{artistTracks.length} 首</Text>
              <Icon name="forward" size={14} color="#ffffff70" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`查看专辑：${current.album}`}
              onPress={() =>
                openCollection({
                  kind: "album",
                  key: albumKey(current),
                  from: "details",
                })
              }
              style={styles.link}
            >
              <Cover
                track={current}
                size={34}
                style={{ borderRadius: 5, flexShrink: 0 }}
              />
              <Text numberOfLines={2} style={styles.linkTitle}>
                <Text style={styles.linkLabel}>专辑 · </Text>
                {current.album}
              </Text>
              <Text style={styles.caption}>
                {currentAlbum?.tracks.length || 0} 首
              </Text>
              <Icon name="forward" size={14} color="#ffffff70" />
            </Pressable>
          </View>
          {!collection && (
            <>
              {!landscape && renderAlbums()}
              <Text style={styles.sectionHeading}>音频参数</Text>
              <View style={styles.audioGrid}>
                {[
                  ...details.audio,
                  ...(current.format.toUpperCase() === "DSF" && supportsDsf
                    ? [["播放方式", "DSD → PCM · 软件解码"]]
                    : []),
                ].map(([label, value]) => (
                  <View key={label} style={styles.audioCell}>
                    <Text style={styles.caption}>{label}</Text>
                    <Text selectable style={styles.audioValue}>
                      {value}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.note}>源文件参数</Text>
            </>
          )}
        </View>
        <View style={landscape ? styles.column : undefined}>
          {!collection && landscape && renderAlbums()}
          {collection?.kind === "artist" ? renderAlbums(true) : renderList()}
          {!collection && (
            <>
              <Text style={styles.sectionHeading}>文件信息</Text>
              <DetailRows rows={details.file} />
              {current.warning && (
                <Text style={styles.warning}>
                  标签读取提示：{current.warning}
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <PlaybackControls onQueue={onQueue} />
      </View>
    </View>
  );
}

function DetailRows({ rows }: { rows: DetailRow[] }) {
  return (
    <View>
      {rows.map(([label, value]) => {
        const multiline = ["文件名", "文件路径"].includes(label);
        return (
          <View
            key={label}
            style={[styles.detailRow, multiline && styles.detailStack]}
          >
            <Text style={styles.detailLabel}>{label}</Text>
            <Text
              selectable
              style={[styles.detailValue, multiline && styles.pathValue]}
            >
              {value}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 28, paddingTop: 14, paddingBottom: 24 },
  wide: { flexDirection: "row", gap: 28 },
  column: { flex: 1, minWidth: 0 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  title: { color: "#fff8f0", fontSize: 23, lineHeight: 29, fontWeight: "600" },
  muted: { color: "#ffffffa6", fontSize: 13, lineHeight: 19 },
  links: {
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ffffff18",
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingVertical: 7,
  },
  linkLabel: { color: "#ffffff90", fontSize: 12 },
  linkTitle: { color: "#f7f0e6", fontSize: 14, lineHeight: 20, flex: 1 },
  caption: { color: "#ffffff90", fontSize: 11, lineHeight: 16 },
  sectionHeading: {
    color: "#fff5e8",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 6,
    gap: 12,
  },
  detailStack: { flexDirection: "column", gap: 5, paddingVertical: 9 },
  detailLabel: { color: "#ffffff80", fontSize: 12, lineHeight: 19, width: 78 },
  detailValue: { flex: 1, color: "#f4ede3", fontSize: 13, lineHeight: 19 },
  pathValue: {
    flex: 0,
    alignSelf: "stretch",
    color: "#ffffffbf",
    lineHeight: 20,
  },
  audioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#ffffff07",
    borderRadius: 12,
    padding: 6,
  },
  audioCell: {
    width: "50%",
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 3,
  },
  audioValue: {
    color: "#f4e1c7",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  note: { color: "#ffffff68", fontSize: 10, marginTop: 7 },
  warning: { color: "#ddac96", fontSize: 12, lineHeight: 19, marginTop: 12 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    marginTop: 12,
    gap: 8,
  },
  sectionTitle: { color: "#fff5e8", fontSize: 16, fontWeight: "600" },
  albumGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 16,
    marginBottom: 18,
  },
  albumCard: { width: "48%", gap: 4 },
  albumArtwork: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 4,
    backgroundColor: "#ffffff08",
  },
  albumCount: {
    position: "absolute",
    right: 7,
    bottom: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "#17191cd9",
  },
  albumCountText: { color: "#fff6e8", fontSize: 10, fontWeight: "500" },
  albumTitle: {
    color: "#fff5e8",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  albumSummary: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 10,
  },
  back: { minHeight: 44, justifyContent: "center" },
  track: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    minHeight: 54,
    paddingVertical: 7,
  },
  trackTitle: { color: "#fff5e8", fontSize: 14, fontWeight: "500" },
  emptyText: {
    color: "#ffffff87",
    fontSize: 13,
    lineHeight: 22,
    paddingVertical: 16,
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  footer: { paddingHorizontal: 28 },
});
