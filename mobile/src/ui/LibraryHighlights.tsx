import React, { useRef, type ComponentRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Track } from "../core/types";
import { Cover, Icon, palette as p } from "./visuals";

export function LibraryHighlights({
  current,
  daily,
  related,
  favorites,
  onDaily,
  onResume,
  onRelated,
  onFavorites,
  scrollPositionRef,
}: {
  current?: Track;
  daily: Track[];
  related: Track[];
  favorites: Track[];
  onDaily: () => void;
  onResume: () => void;
  onRelated: () => void;
  onFavorites: () => void;
  scrollPositionRef: { current: number };
}) {
  const { width, height, fontScale } = useWindowDimensions();
  const landscape = width > height;
  const compact = landscape || height < 740;
  const artSize = landscape ? 48 : compact ? 58 : 64;
  const cardWidth = Math.min(286, width - 76);
  const railRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const cards = [
    {
      key: "daily",
      label: "每日精选",
      kicker: "DAILY MIX",
      detail: `今天的 ${daily.length} 首 · 每日更新`,
      cover: daily[0],
      icon: "play",
      colors: ["#474237", "#292b29"] as const,
      action: onDaily,
    },
    {
      key: "resume",
      label: current?.title || "从一首歌开始",
      kicker: "继续聆听",
      detail: current ? current.artist : "打开你的播放页面",
      cover: current,
      icon: "play",
      colors: ["#34404a", "#252a31"] as const,
      action: onResume,
    },
    {
      key: "related",
      label: "猜你喜欢",
      kicker: "MORE TO LOVE",
      detail: related.length
        ? `为你的曲库精选 · ${related.length} 首`
        : "聆听与收藏，发现更多",
      cover: related[0],
      icon: "disc",
      colors: ["#423b43", "#2d2a30"] as const,
      action: onRelated,
    },
    {
      key: "favorites",
      label: "喜欢的音乐",
      kicker: "YOUR FAVORITES",
      detail: `${favorites.length} 首珍藏 · 随时重听`,
      cover: favorites[0],
      icon: "heart",
      colors: ["#483c34", "#302a27"] as const,
      action: onFavorites,
    },
  ];
  return (
    <ScrollView
      ref={railRef}
      horizontal
      accessibilityLabel="音乐精选卡片"
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={cardWidth + 12}
      onLayout={() =>
        railRef.current?.scrollTo({
          x: scrollPositionRef.current,
          animated: false,
        })
      }
      onScroll={(event) => {
        scrollPositionRef.current = event.nativeEvent.contentOffset.x;
      }}
      scrollEventThrottle={32}
      style={[styles.rail, compact && { marginBottom: 12 }]}
      contentContainerStyle={styles.content}
    >
      {cards.map((card) => (
        <Pressable
          key={card.key}
          accessibilityRole="button"
          accessibilityLabel={
            card.key === "resume" ? "继续聆听上次的歌曲" : card.label
          }
          onPress={card.action}
          style={({ pressed }) => [
            styles.card,
            {
              width: cardWidth,
              minHeight:
                (landscape ? 80 : compact ? 96 : 108) * Math.max(1, fontScale),
              padding: compact ? 13 : 16,
              opacity: pressed ? 0.78 : 1,
            },
          ]}
        >
          <LinearGradient
            colors={card.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.copy}>
            <Text numberOfLines={1} style={styles.kicker}>
              {card.kicker}
            </Text>
            <Text numberOfLines={1} style={styles.title}>
              {card.label}
            </Text>
            <Text numberOfLines={1} style={styles.detail}>
              {card.detail}
            </Text>
          </View>
          <View
            style={[styles.art, { width: artSize + 4, height: artSize + 6 }]}
          >
            <View
              style={[styles.sleeve, { width: artSize - 2, height: artSize }]}
            />
            {card.cover ? (
              <Cover track={card.cover} size={artSize} style={styles.cover} />
            ) : (
              <View
                style={[
                  styles.cover,
                  styles.placeholder,
                  { width: artSize, height: artSize },
                ]}
              >
                <Icon name={card.icon} color={p.gold} size={28} />
              </View>
            )}
            <View style={styles.badge}>
              <Icon name={card.icon} size={13} color="#e7d7b8" />
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { marginHorizontal: -24, marginBottom: 18, flexGrow: 0 },
  content: { paddingHorizontal: 24, gap: 12 },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#e6cfaa13",
  },
  copy: { flex: 1, gap: 7 },
  kicker: {
    color: "#d7c5a5",
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: "500",
  },
  title: { color: "#f5f0e5", fontSize: 18, fontWeight: "600" },
  detail: { color: "#c0b9ae", fontSize: 10 },
  art: { width: 68, height: 72, justifyContent: "center" },
  sleeve: {
    position: "absolute",
    width: 62,
    height: 64,
    borderRadius: 9,
    backgroundColor: "#dbccad28",
    transform: [{ rotate: "10deg" }],
    right: 0,
    top: 1,
  },
  cover: { borderRadius: 9, transform: [{ rotate: "-5deg" }] },
  placeholder: {
    width: 64,
    height: 64,
    backgroundColor: "#212327",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#292b2b",
    borderColor: "#e5c99b45",
    borderWidth: 1,
  },
});
