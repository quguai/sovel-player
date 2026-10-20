import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { albumKey } from "../core/artistAlbums";
import type { Track } from "../core/types";
import { ArtistAvatar, Cover, Icon, palette as p } from "./visuals";

/** A collection's cover and its artist portrait are deliberately separate sources. */
export function CollectionItem({
  kind,
  tracks,
  title,
  layout,
  width,
  onPress,
}: {
  kind: "albums" | "artists" | "folders";
  tracks: Track[];
  title: string;
  layout: "cards" | "list";
  width: number;
  onPress: () => void;
}) {
  const artist = kind === "artists";
  const cover = tracks.find((t) => t.artwork) || tracks[0];
  const portrait = tracks.find((t) => t.artistArtwork)?.artistArtwork;
  const albums = new Set(tracks.map(albumKey)).size;
  const subtitle = artist
    ? `${albums} 张专辑 · ${tracks.length} 首歌曲`
    : kind === "albums"
      ? cover.albumArtist || cover.artist
      : `${tracks.length} 首歌曲`;
  if (layout === "list")
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`打开 ${title}`}
        style={({ pressed }) => [s.list, { opacity: pressed ? 0.65 : 1 }]}
      >
        {artist ? (
          <ArtistAvatar artwork={portrait} name={title} size={54} />
        ) : (
          <Cover track={cover} size={54} style={{ borderRadius: 8 }} />
        )}
        <View style={{ flex: 1, gap: 5 }}>
          <Text numberOfLines={1} style={s.title}>
            {title}
          </Text>
          <Text numberOfLines={1} style={s.subtitle}>
            {subtitle}
          </Text>
        </View>
        {!artist && (
          <Text style={s.count}>
            {tracks.length}
            <Text style={{ fontSize: 10 }}> 首</Text>
          </Text>
        )}
        <Icon name="forward" size={14} color={p.muted} />
      </Pressable>
    );
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`打开 ${title}`}
      style={({ pressed }) => [
        { width, marginTop: 18, marginBottom: 12, opacity: pressed ? 0.65 : 1 },
      ]}
    >
      {artist ? (
        <View style={[s.portrait, { height: width }]}>
          <LinearGradient
            colors={["#d5b78213", "#d5b78200"]}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              padding: 5,
              borderRadius: width,
              borderWidth: 1,
              borderColor: "#d5b78220",
            }}
          >
            <ArtistAvatar artwork={portrait} name={title} size={width * 0.72} />
          </View>
        </View>
      ) : (
        <View style={{ paddingTop: 7 }}>
          <View style={s.backSleeve} />
          <View style={s.frontSleeve} />
          <View style={{ borderRadius: 12, overflow: "hidden" }}>
            <Cover track={cover} style={{ width: "100%", aspectRatio: 1 }} />
            <LinearGradient
              colors={["transparent", "#00000055"]}
              style={[StyleSheet.absoluteFill, { top: "55%" }]}
            />
            <View style={s.badge}>
              <Icon name="disc" size={11} color="#fff" />
              <Text style={s.badgeText}>{tracks.length} 首</Text>
            </View>
          </View>
        </View>
      )}
      <Text
        numberOfLines={1}
        style={[s.title, { marginTop: 12 }, artist && { textAlign: "center" }]}
      >
        {title}
      </Text>
      <Text
        numberOfLines={1}
        style={[
          s.subtitle,
          { marginTop: 5 },
          artist && { textAlign: "center" },
        ]}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  title: { color: p.text, fontSize: 15, fontWeight: "600", letterSpacing: 0.1 },
  subtitle: { color: p.muted, fontSize: 11, lineHeight: 17 },
  portrait: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    overflow: "hidden",
  },
  backSleeve: {
    position: "absolute",
    top: 0,
    left: 13,
    right: 13,
    height: 24,
    borderRadius: 10,
    backgroundColor: "#d5b78220",
  },
  frontSleeve: {
    position: "absolute",
    top: 3,
    left: 6,
    right: 6,
    height: 24,
    borderRadius: 10,
    backgroundColor: "#73706a55",
  },
  badge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: "#15161899",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  list: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: p.line,
  },
  count: { color: p.gold, fontSize: 14, fontVariant: ["tabular-nums"] },
});
