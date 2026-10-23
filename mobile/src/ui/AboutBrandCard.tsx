import { useEffect, useId, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Rect,
  Stop,
} from "react-native-svg";

/** Decorative tilt observes touches, leaving the parent ScrollView in charge of scrolling. */
export function AboutBrandCard({ version }: { version: string }) {
  const [position] = useState(() => new Animated.ValueXY());
  const [lift] = useState(() => new Animated.Value(0));
  const bounds = useRef({ width: 1, height: 1 });
  const tracking = useRef(false);
  const [reduced, setReduced] = useState(true);
  const gradient = useId();

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {});
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    const state = AppState.addEventListener("change", (value) => {
      if (value === "active") return;
      tracking.current = false;
      position.stopAnimation();
      lift.stopAnimation();
      position.setValue({ x: 0, y: 0 });
      lift.setValue(0);
    });
    return () => {
      mounted = false;
      motion.remove();
      state.remove();
      position.stopAnimation();
      lift.stopAnimation();
    };
  }, [position, lift]);
  useEffect(() => {
    if (!reduced) return;
    tracking.current = false;
    position.stopAnimation();
    lift.stopAnimation();
    position.setValue({ x: 0, y: 0 });
    lift.setValue(0);
  }, [reduced, position, lift]);

  const follow = (event: GestureResponderEvent) => {
    if (event.nativeEvent.touches.length !== 1) {
      reset();
      return;
    }
    if (!tracking.current) return;
    const { locationX, locationY } = event.nativeEvent;
    const unit = (value: number, size: number) =>
      Math.max(-1, Math.min(1, (value / size) * 2 - 1));
    position.setValue({
      x: unit(locationX, bounds.current.width),
      y: unit(locationY, bounds.current.height),
    });
  };
  const reset = () => {
    tracking.current = false;
    if (reduced) return;
    Animated.parallel([
      Animated.spring(position, {
        toValue: { x: 0, y: 0 },
        stiffness: 230,
        damping: 27,
        mass: 1,
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]).start();
  };
  return (
    <View
      testID="about-brand-card"
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Sovel HiFi，收藏声音，慢慢聆听。版本 ${version}，开源音乐播放器`}
      onLayout={(event) => {
        bounds.current = event.nativeEvent.layout;
      }}
      onTouchStart={(event) => {
        if (reduced || event.nativeEvent.touches.length !== 1) return;
        tracking.current = true;
        position.stopAnimation();
        lift.stopAnimation();
        follow(event);
        Animated.timing(lift, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
          isInteraction: false,
        }).start();
      }}
      onTouchMove={follow}
      onTouchEnd={reset}
      onTouchCancel={reset}
      style={s.frame}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          s.card,
          {
            transform: [
              { perspective: 900 },
              {
                rotateX: position.y.interpolate({
                  inputRange: [-1, 1],
                  outputRange: ["7deg", "-7deg"],
                }),
              },
              {
                rotateY: position.x.interpolate({
                  inputRange: [-1, 1],
                  outputRange: ["-7deg", "7deg"],
                }),
              },
              {
                scale: lift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.012],
                }),
              },
            ],
          },
        ]}
      >
        <View style={[StyleSheet.absoluteFill, s.clip]}>
          <LinearGradient
            colors={["#343028", "#1c1d1d", "#151718"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            style={[
              s.record,
              {
                transform: [
                  { translateX: Animated.multiply(position.x, -5) },
                  { translateY: Animated.multiply(position.y, -5) },
                ],
              },
            ]}
          >
            <Svg width={228} height={228} viewBox="0 0 228 228">
              <Defs>
                <SvgGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#f5e4bb" />
                  <Stop offset="0.45" stopColor="#c69b5d" />
                  <Stop offset="1" stopColor="#705834" />
                </SvgGradient>
              </Defs>
              <Circle
                cx={114}
                cy={114}
                r={110}
                fill="#141617"
                stroke="#e4c48a20"
              />
              {[100, 96, 89, 85, 78, 74, 67].map((r, i) => (
                <Circle
                  key={r}
                  cx={114}
                  cy={114}
                  r={r}
                  fill="none"
                  stroke={i % 2 ? "#ffffff08" : "#dfc18c13"}
                  strokeWidth={0.7}
                />
              ))}
              <Circle
                cx={114}
                cy={114}
                r={49}
                fill="#24231f"
                stroke="#e4c48a35"
                strokeWidth={0.7}
              />
              {[26, 45, 64, 45, 26].map((height, i) => (
                <Rect
                  key={i}
                  x={78 + i * 15}
                  y={114 - height / 2}
                  width={12}
                  height={height}
                  rx={6}
                  fill={`url(#${gradient})`}
                />
              ))}
            </Svg>
          </Animated.View>
        </View>
        <View style={s.top}>
          <View style={s.dot} />
          <Text style={s.eyebrow}>SOVEL HIFI</Text>
          <View style={{ flex: 1 }} />
          <Text style={s.edition}>MUSIC, YOURS.</Text>
        </View>
        <Animated.View
          style={[
            s.identity,
            {
              transform: [
                { translateX: Animated.multiply(position.x, 3) },
                { translateY: Animated.multiply(position.y, 3) },
              ],
            },
          ]}
        >
          <Text style={s.wordmark}>Sovel</Text>
          <Text style={s.tagline}>收藏声音，慢慢聆听。</Text>
        </Animated.View>
        <View style={s.bottom}>
          <Text style={s.version}>{version}</Text>
          <Text style={s.open}>OPEN SOURCE</Text>
        </View>
        <View style={[StyleSheet.absoluteFill, s.clip]}>
          <Animated.View
            style={[
              s.sheen,
              {
                opacity: lift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.12, 0.65],
                }),
                transform: [
                  { translateX: Animated.multiply(position.x, 100) },
                  { translateY: Animated.multiply(position.y, 25) },
                  { rotate: "-24deg" },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={["#ffffff00", "#fff1cd22", "#ffffff00"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}
const s = StyleSheet.create({
  frame: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    marginTop: 4,
    marginBottom: 24,
    paddingVertical: 6,
  },
  card: {
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#d9ba8238",
    paddingHorizontal: 21,
    paddingTop: 19,
    paddingBottom: 16,
    backgroundColor: "#1c1d1d",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    shadowOpacity: 0.24,
    elevation: 4,
  },
  clip: { borderRadius: 22, overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#e0c58d" },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.8,
    fontWeight: "600",
    color: "#dec99e",
  },
  edition: { fontSize: 8, letterSpacing: 1.1, color: "#a59a85" },
  identity: { minHeight: 154, justifyContent: "center", paddingVertical: 24 },
  wordmark: {
    fontSize: 45,
    letterSpacing: -2,
    color: "#f1e5cd",
    fontWeight: "500",
  },
  tagline: { fontSize: 12, lineHeight: 20, color: "#c5b79e", marginTop: 6 },
  bottom: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#d7bf9229",
    paddingTop: 12,
  },
  version: { color: "#bcb19b", fontSize: 10, letterSpacing: 0.4 },
  open: { color: "#d5ba83", fontSize: 9, letterSpacing: 1.6 },
  record: { position: "absolute", right: -77, top: 5, opacity: 0.64 },
  sheen: {
    position: "absolute",
    left: "35%",
    top: -110,
    width: 140,
    height: 480,
  },
});
