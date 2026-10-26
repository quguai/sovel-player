import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderHandlers,
} from "react-native";
import type { LyricLine, Track } from "../core/types";
import { lyricSeekTime } from "../core/lyrics";
import { lyricFocus, lyricMetrics } from "../core/lyricPresentation";
import { useLyricIndex, useMusic } from "../services/store";
import { PlayingCassette, useCassetteMotion } from "./Cassette";
import { PlaybackControls } from "./components";
import { FocusedLyricLine } from "./FocusedLyricLine";

export function CassetteLandscapePlayer({
  track,
  active,
  onQueue,
  dismissPanHandlers,
}: {
  track: Track;
  active: boolean;
  onQueue: () => void;
  dismissPanHandlers?: GestureResponderHandlers;
}) {
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const size = Math.max(0, Math.min(stage.width, (stage.height * 420) / 270));
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        gap: 26,
        paddingHorizontal: 24,
        paddingBottom: 4,
      }}
    >
      <View style={{ flex: 1.3, minWidth: 0 }}>
        <View
          {...dismissPanHandlers}
          onLayout={({ nativeEvent: { layout } }) =>
            setStage({ width: layout.width, height: layout.height })
          }
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          {size > 0 && (
            <PlayingCassette track={track} active={active} width={size} />
          )}
        </View>
        <PlaybackControls onQueue={onQueue} />
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingTop: 6 }}>
        <View {...dismissPanHandlers} style={{ paddingBottom: 10 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}
          >
            {track.title}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontSize: 12, color: "#ffffff85", marginTop: 4 }}
          >
            {track.artist}
          </Text>
        </View>
        <CassetteLyrics key={track.id} track={track} active={active} />
      </View>
    </View>
  );
}

function CassetteLyrics({ track, active }: { track: Track; active: boolean }) {
  const { seek, lyricOffset, prefs } = useMusic();
  const index = useLyricIndex(track.lyrics, lyricOffset);
  const { fontScale } = useWindowDimensions();
  const { reduced } = useCassetteMotion(active);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [browsing, setBrowsing] = useState(false);
  const scroll = useRef<FlatList<LyricLine>>(null);
  const browseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const attempts = useRef(0);
  const metrics = lyricMetrics(size.width, fontScale, prefs.largeLyrics);
  const timed = useMemo(
    () => track.lyrics.some((line) => line.time !== null),
    [track.lyrics],
  );
  const follow = useCallback(() => {
    if (active && !browsing && index >= 0 && size.height > 0)
      scroll.current?.scrollToIndex({
        index,
        viewPosition: 0.4,
        animated: !reduced,
      });
  }, [active, browsing, index, size.height, reduced]);
  useEffect(() => {
    attempts.current = 0;
    follow();
    return () => clearTimeout(retryTimer.current);
  }, [follow, size.width, fontScale]);
  useEffect(
    () => () => {
      clearTimeout(browseTimer.current);
      clearTimeout(retryTimer.current);
    },
    [],
  );
  const resumeFollowing = () => {
    clearTimeout(browseTimer.current);
    browseTimer.current = setTimeout(() => setBrowsing(false), 4000);
  };
  return (
    <View
      style={{ flex: 1, overflow: "hidden" }}
      onLayout={({ nativeEvent: { layout } }) =>
        setSize({ width: layout.width, height: layout.height })
      }
    >
      <FlatList
        ref={scroll}
        data={track.lyrics}
        extraData={`${index}-${browsing}-${size.width}-${fontScale}-${prefs.largeLyrics}`}
        keyExtractor={(_, i) => String(i)}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        windowSize={5}
        contentContainerStyle={{
          paddingTop: 10,
          paddingBottom: size.height * 0.6,
        }}
        onContentSizeChange={follow}
        onScrollBeginDrag={() => {
          clearTimeout(browseTimer.current);
          clearTimeout(retryTimer.current);
          setBrowsing(true);
        }}
        onScrollEndDrag={resumeFollowing}
        onMomentumScrollBegin={() => clearTimeout(browseTimer.current)}
        onMomentumScrollEnd={resumeFollowing}
        onScrollToIndexFailed={({ index: target, averageItemLength }) => {
          if (!active || browsing || attempts.current++ >= 5) return;
          scroll.current?.scrollToOffset({
            offset: Math.max(0, target * averageItemLength - size.height * 0.4),
            animated: false,
          });
          clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(follow, 120);
        }}
        ListEmptyComponent={
          <Text style={{ color: "#ffffff80", fontSize: 17, marginTop: 28 }}>
            暂无歌词，专注聆听
          </Text>
        }
        renderItem={({ item, index: line }) => {
          const focus = lyricFocus(
            index < 0 ? Infinity : Math.abs(line - index),
            timed,
            browsing,
          );
          return (
            <Pressable
              accessibilityRole={item.time !== null ? "button" : "text"}
              accessibilityLabel={item.text}
              accessibilityState={{ selected: line === index }}
              disabled={item.time === null}
              onPress={() => {
                if (item.time !== null) {
                  seek(lyricSeekTime(item.time, lyricOffset));
                  setBrowsing(false);
                }
              }}
              style={{ paddingVertical: 15, minHeight: metrics.minRowHeight }}
            >
              <FocusedLyricLine
                text={item.text || "♪"}
                fontSize={metrics.fontSize}
                lineHeight={metrics.lineHeight}
                fontScale={fontScale}
                opacity={focus.opacity}
                blur={focus.blur}
                reduced={reduced}
              />
            </Pressable>
          );
        }}
      />
    </View>
  );
}
