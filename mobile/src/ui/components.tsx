import React, {
  useState,
  useRef,
  useEffect,
  type ComponentRef,
  type RefObject,
} from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Icon, palette, Record } from "./visuals";
import { useMusic, usePlaybackProgress } from "../services/store";
import { playbackModes } from "../core/types";
export function Action({
  icon,
  label,
  onPress,
  size = 23,
  color = palette.text,
  selected = false,
  style,
  disabled = false,
  busy = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  size?: number;
  color?: string;
  selected?: boolean;
  style?: ViewStyle;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={3}
      style={({ pressed }) => [
        {
          width: 46,
          height: 46,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.3 : pressed ? 0.55 : 1,
        },
        style,
      ]}
    >
      <Icon
        name={icon}
        size={size}
        color={color}
        filled={selected && icon === "heart"}
      />
      {busy && (
        <ActivityIndicator
          size="small"
          color={color}
          pointerEvents="none"
          style={{
            position: "absolute",
            right: -3,
            top: -3,
            transform: [{ scale: 0.65 }],
          }}
        />
      )}
    </Pressable>
  );
}
export function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: 12,
        minHeight: 48,
        paddingHorizontal: 18,
        paddingVertical: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: secondary ? "#ffffff09" : palette.gold,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        borderColor: palette.gold + "30",
        borderWidth: secondary ? 1 : 0,
      })}
    >
      <Text
        style={{
          color: secondary ? palette.gold : "#27241e",
          fontWeight: "600",
          fontSize: 14,
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}
export const time = (n: number) => {
  const v = Math.max(0, Number.isFinite(n) ? n : 0);
  return `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, "0")}`;
};
export function Progress() {
  const { current, seek: seekPlayback, setError } = useMusic();
  const status = usePlaybackProgress();
  const [seek, setSeek] = useState<number | null>(null),
    width = useRef(1),
    position = useRef(0);
  const duration = status.duration || current?.duration || 0;
  const update = (x: number) => {
    position.current = Math.max(
      0,
      Math.min(duration, (x / width.current) * duration),
    );
    setSeek(position.current);
  };
  const commit = (seconds: number) => {
    seekPlayback(seconds)
      .catch((e) => setError(String(e)))
      .finally(() => setSeek(null));
  };
  // PanResponder registers these handlers without executing them during render.
  // eslint-disable-next-line react-hooks/refs
  const gesture = PanResponder.create({
    onStartShouldSetPanResponder: () => status.isLoaded,
    onPanResponderGrant: (e) => update(e.nativeEvent.locationX),
    onPanResponderMove: (e) => update(e.nativeEvent.locationX),
    onPanResponderRelease: () => commit(position.current),
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: () => setSeek(null),
  });
  const value = seek ?? status.currentTime,
    percent = Math.max(0, Math.min(100, (value / Math.max(1, duration)) * 100));
  return (
    <View>
      <View
        {...gesture.panHandlers}
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width;
        }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="播放进度"
        accessibilityValue={{
          min: 0,
          max: duration,
          now: value,
          text: time(value),
        }}
        accessibilityActions={[
          { name: "increment", label: "前进十秒" },
          { name: "decrement", label: "后退十秒" },
        ]}
        onAccessibilityAction={(e) =>
          commit(
            Math.max(
              0,
              Math.min(
                duration,
                value + (e.nativeEvent.actionName === "increment" ? 10 : -10),
              ),
            ),
          )
        }
        style={{ height: 34, justifyContent: "center" }}
      >
        <View
          pointerEvents="none"
          style={{ height: 3, borderRadius: 3, backgroundColor: "#ffffff35" }}
        >
          <View
            style={{
              height: 3,
              borderRadius: 3,
              width: `${percent}%`,
              backgroundColor: "#f5f0e7",
            }}
          />
          <View
            style={{
              position: "absolute",
              width: seek === null ? 8 : 12,
              height: seek === null ? 8 : 12,
              borderRadius: 8,
              backgroundColor: "#f5f0e7",
              left: `${percent}%`,
              marginLeft: seek === null ? -4 : -6,
              top: seek === null ? -2.5 : -4.5,
            }}
          />
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={s.time}>{time(value)}</Text>
        <Text style={s.time}>{time(duration)}</Text>
      </View>
    </View>
  );
}
export function Transport({ onQueue }: { onQueue: () => void }) {
  const { width, height } = useWindowDimensions();
  const dense = height < 740 || width > height;
  const {
    controlPlaying,
    playbackLoading,
    toggle,
    skipTrack,
    prefs,
    cyclePlaybackMode,
    current,
  } = useMusic();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginVertical: 8,
      }}
    >
      <Action
        icon={playbackModes[prefs.playbackMode].icon}
        label={`${playbackModes[prefs.playbackMode].name}，点击切换播放方式`}
        onPress={cyclePlaybackMode}
        color="#ffffffa0"
      />
      <Action
        icon="previous"
        label="上一首"
        onPress={() => skipTrack(-1)}
        size={27}
        disabled={!current}
      />
      <Action
        icon={controlPlaying ? "pause" : "play"}
        label={controlPlaying ? "暂停" : "播放"}
        busy={playbackLoading}
        onPress={toggle}
        size={31}
        disabled={!current}
        style={{
          width: dense ? 56 : 64,
          height: dense ? 56 : 64,
          borderRadius: 40,
          borderColor: "#ffffffb0",
          borderWidth: 1.2,
        }}
      />
      <Action
        icon="next"
        label="下一首"
        onPress={() => skipTrack(1)}
        size={27}
        disabled={!current}
      />
      <Action
        icon="queue"
        label="播放队列"
        onPress={onQueue}
        color="#ffffffa0"
      />
    </View>
  );
}
export function PlaybackControls({ onQueue }: { onQueue: () => void }) {
  return (
    <View testID="playback-controls" style={{ paddingBottom: 5 }}>
      <Progress />
      <Transport onQueue={onQueue} />
    </View>
  );
}
export function FrostedSurface({
  children,
  blurTarget,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  blurTarget: RefObject<ComponentRef<typeof View> | null>;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const [opaque, setOpaque] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceTransparencyEnabled().then(setOpaque);
    const listener = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setOpaque,
    );
    return () => listener.remove();
  }, []);
  return (
    <View style={[s.glassShadow, style]}>
      <View style={[s.glassClip, opaque && { backgroundColor: "#292825" }]}>
        {!opaque && (
          <BlurView
            pointerEvents="none"
            blurTarget={blurTarget}
            blurMethod="dimezisBlurViewSdk31Plus"
            tint="dark"
            intensity={42}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          pointerEvents="none"
          colors={["#e9d5b51c", "#d3bb9009", "#ffffff05"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      </View>
    </View>
  );
}
export function MiniPlayer({
  onOpen,
  onQueue,
  blurTarget,
  compact = false,
  landscape = false,
  active = true,
}: {
  onOpen: () => void;
  onQueue: () => void;
  blurTarget: RefObject<ComponentRef<typeof View> | null>;
  compact?: boolean;
  landscape?: boolean;
  active?: boolean;
}) {
  const { current, toggle, status, prefs, controlPlaying, playbackLoading } =
    useMusic();
  if (!current) return null;
  return (
    <FrostedSurface
      blurTarget={blurTarget}
      style={[{ height: compact ? 52 : 56 }, landscape && { flex: 1 }]}
      contentStyle={s.mini}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="打开播放页面"
        onPress={onOpen}
        style={{
          flex: 1,
          minWidth: 0,
          height: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
        }}
      >
        <Record
          track={current}
          material="black"
          size={44}
          mini
          artworkRatio={0.64}
          playing={active && status.playing}
          speed={prefs.recordSpeed}
        />
        <Text numberOfLines={1} style={[s.title, { flex: 1 }]}>
          {current.title}
          <Text style={s.miniArtist}> · {current.artist}</Text>
        </Text>
      </Pressable>
      <Action
        icon={controlPlaying ? "pause" : "play"}
        label={controlPlaying ? "暂停" : "播放"}
        busy={playbackLoading}
        onPress={toggle}
        size={20}
        color={palette.gold}
        style={s.miniAction}
      />
      <Action
        icon="queue"
        label="播放队列"
        onPress={onQueue}
        size={20}
        color="#d3c9b8"
        style={s.miniAction}
      />
    </FrostedSurface>
  );
}
const s = StyleSheet.create({
  time: { fontSize: 11, color: "#ffffff90", fontVariant: ["tabular-nums"] },
  mini: {
    paddingLeft: 6,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  glassShadow: {
    borderRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  glassClip: {
    flex: 1,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#282829e6",
  },
  miniAction: { width: 44, height: 44 },
  title: { fontSize: 13, fontWeight: "600", color: palette.text },
  miniArtist: { color: "#aaa294", fontWeight: "400" },
});

// SafeAreaView owns the inset; 6 + (46 - 23) / 2 gives a ~18 pt icon edge.
export const navigationHeader = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    minHeight: 52,
  },
}).row;
