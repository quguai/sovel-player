import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderHandlers,
} from "react-native";
import { Action, navigationHeader } from "./components";
import { PlayerScreen, LyricsScreen } from "./screens";
import { SongContextScreen } from "./SongContextScreen";
import { PlayerAppearanceSheet } from "./PlayerAppearanceSheet";

export type PlayerPanel = "about" | "player" | "lyrics";
const panels = ["about", "player", "lyrics"] as const;
const labels = ["歌曲详情", "正在播放", "完整歌词"];

export function PlayerDeck({
  panel,
  onPanel,
  onClose,
  onDetails,
  onQueue,
  dismissPanHandlers,
}: {
  panel: PlayerPanel;
  onPanel: (panel: PlayerPanel) => void;
  onClose: () => void;
  onDetails: () => void;
  onQueue: () => void;
  dismissPanHandlers?: GestureResponderHandlers;
}) {
  const window = useWindowDimensions();
  const [width, setWidth] = useState(window.width);
  const [appearance, setAppearance] = useState(false);
  const [neighborsReady, setNeighborsReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const previousWidth = useRef(0);
  const index = panels.indexOf(panel);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => listener.remove();
  }, []);
  useLayoutEffect(() => {
    scroll.current?.scrollTo({
      x: index * width,
      animated: previousWidth.current === width && !reduced,
    });
    previousWidth.current = width;
  }, [index, width, reduced]);
  return (
    <View
      style={styles.root}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View
        {...(!appearance ? dismissPanHandlers : undefined)}
        style={[
          navigationHeader,
          {
            height:
              window.height < 740 || window.width > window.height ? 48 : 60,
          },
        ]}
      >
        <Action icon="down" label="返回音乐库" onPress={onClose} />
        <View style={styles.dots} testID="player-page-indicator">
          {panels.map((item, i) => (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityLabel={labels[i]}
              accessibilityState={{ selected: panel === item }}
              onPress={() => onPanel(item)}
              style={styles.anchor}
            >
              <View style={[styles.dot, panel === item && styles.activeDot]} />
            </Pressable>
          ))}
        </View>
        <Action
          icon="shirt"
          size={27}
          label="打开播放外观"
          onPress={() => setAppearance(true)}
        />
      </View>
      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        directionalLockEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: index * width, y: 0 }}
        scrollEnabled={!appearance}
        onScrollBeginDrag={() => setNeighborsReady(true)}
        onMomentumScrollEnd={(event) => {
          const next = Math.max(
            0,
            Math.min(2, Math.round(event.nativeEvent.contentOffset.x / width)),
          );
          onPanel(panels[next]);
        }}
        style={styles.root}
      >
        {panels.map((item) => (
          <View
            key={item}
            style={{ width }}
            accessibilityElementsHidden={panel !== item}
            importantForAccessibility={
              panel === item ? "auto" : "no-hide-descendants"
            }
          >
            {item !== "player" &&
            panel !== item &&
            !neighborsReady ? null : item === "about" ? (
              <SongContextScreen
                onPlay={() => onPanel("player")}
                onQueue={onQueue}
              />
            ) : item === "player" ? (
              <PlayerScreen
                onClose={onClose}
                onLyrics={() => onPanel("lyrics")}
                onDetails={onDetails}
                onQueue={onQueue}
                animateLyrics={panel === "player" && !appearance && !reduced}
                dismissPanHandlers={
                  panel === "player" && !appearance
                    ? dismissPanHandlers
                    : undefined
                }
              />
            ) : (
              <LyricsScreen
                onQueue={onQueue}
                animateLyrics={panel === "lyrics" && !appearance && !reduced}
              />
            )}
          </View>
        ))}
      </ScrollView>
      <PlayerAppearanceSheet
        visible={appearance}
        onClose={() => setAppearance(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  anchor: {
    paddingHorizontal: 4,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#fff5e85c" },
  activeDot: { width: 14, backgroundColor: "#fff5e8eb" },
});
