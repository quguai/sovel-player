import { memo, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Image,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const fallback = require("../../assets/artwork/ocean.jpg");
const textureSize = 128;

/** Blur a small cover once, then move the resulting color fields on the native driver. */
export const PlayerBackdrop = memo(function PlayerBackdrop({
  uri,
  immersive,
  active,
}: {
  uri?: string;
  immersive: boolean;
  active: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const phase = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(true);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [failedUri, setFailedUri] = useState<string>();
  const source = uri && uri !== failedUri ? { uri } : fallback;

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
    const state = AppState.addEventListener("change", (value) =>
      setForeground(value === "active"),
    );
    return () => {
      mounted = false;
      motion.remove();
      state.remove();
    };
  }, []);

  useEffect(() => {
    if (!active || immersive || reduced || !foreground) return;
    const travel = (toValue: number) =>
      Animated.timing(phase, {
        toValue,
        duration: 3500,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
        isInteraction: false,
      });
    const motion = Animated.loop(Animated.sequence([travel(1), travel(0)]), {
      iterations: -1,
      resetBeforeIteration: false,
    });
    motion.start();
    return () => motion.stop();
  }, [active, immersive, reduced, foreground, phase]);

  // Overscan also covers landscape corners while the two textures drift independently.
  const scale = (Math.hypot(width, height) * 1.65) / textureSize;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.root]}
    >
      {immersive ? (
        <Image
          source={source}
          onError={() => setFailedUri(uri)}
          resizeMode="cover"
          style={[StyleSheet.absoluteFill, { opacity: 0.75 }]}
        />
      ) : (
        [0, 1].map((layer) => (
          <Animated.Image
            key={layer}
            source={source}
            onError={() => setFailedUri(uri)}
            blurRadius={9}
            resizeMode="cover"
            resizeMethod="resize"
            fadeDuration={0}
            style={[
              styles.texture,
              {
                left: (width - textureSize) / 2,
                top: (height - textureSize) / 2,
                opacity:
                  layer === 0
                    ? 0.9
                    : phase.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.1, 0.8],
                      }),
                transform: [
                  {
                    translateX: phase.interpolate({
                      inputRange: [0, 1],
                      outputRange:
                        layer === 0
                          ? [-width * 0.28, width * 0.28]
                          : [width * 0.28, -width * 0.28],
                    }),
                  },
                  {
                    translateY: phase.interpolate({
                      inputRange: [0, 1],
                      outputRange:
                        layer === 0
                          ? [height * 0.2, -height * 0.2]
                          : [-height * 0.2, height * 0.2],
                    }),
                  },
                  {
                    rotate: phase.interpolate({
                      inputRange: [0, 1],
                      outputRange:
                        layer === 0
                          ? ["-55deg", "55deg"]
                          : ["125deg", "235deg"],
                    }),
                  },
                  { scale },
                ],
              },
            ]}
          />
        ))
      )}
      <LinearGradient
        colors={
          immersive
            ? ["#48444835", "#39313570", "#292b36c9"]
            : ["#12152252", "#18152238", "#14131fbb"]
        }
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { overflow: "hidden", backgroundColor: "#292633" },
  texture: { position: "absolute", width: textureSize, height: textureSize },
});
