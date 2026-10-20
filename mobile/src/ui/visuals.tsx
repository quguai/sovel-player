import React, { useEffect, useId, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
  type ImageSourcePropType,
} from "react-native";
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Mask,
  RadialGradient,
} from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import {
  recordSpeeds,
  cartridgeColors,
  type CartridgeColor,
  stylusLights,
  type StylusLight,
  type RecordSpeed,
  type RecordStyle,
  type TonearmStyle,
  type Track,
} from "../core/types";
import { artUri } from "../services/files";
import { albumPlaceholder, artistPlaceholder } from "../core/placeholderArtwork";
import { placeholderAssets } from "./placeholderAssets";
export const palette = {
  bg: "#17191c",
  surface: "#24262b",
  gold: "#d5b782",
  text: "#f2f0eb",
  muted: "#929398",
  line: "#ffffff12",
};
const icons: Record<string, string> = {
  grid: "M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z",
  list: "M3 5h3v3H3Zm7 1h11M3 11h3v3H3Zm7 1h11M3 17h3v3H3Zm7 1h11",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 6v6l4 2",
  play: "M8 4L21 12 8 20Z",
  pause: "M8 5v14M16 5v14",
  previous: "M5 5v14M19 5L8 12l11 7Z",
  next: "M19 5v14M5 5l11 7L5 19Z",
  down: "M6 9l6 6 6-6",
  back: "M15 5l-7 7 7 7",
  close: "M6 6l12 12M6 18L18 6",
  search: "M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  import: "M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6",
  settings: "M3 7h18M3 17h18M9 4v6M16 14v6",
  shirt:
    "M8.2 3.3C9.1 2.9 9.9 4.7 12 4.7s2.9-1.8 3.8-1.4l4.3 1.6c1.2.5 1.7 1.3 1.7 2.5V9c0 1.2-.7 1.8-1.9 1.6l-2.3-.4v8.6c0 1.5-.7 2.2-2.2 2.2H8.6c-1.5 0-2.2-.7-2.2-2.2v-8.6l-2.3.4C2.9 10.8 2.2 10.2 2.2 9V7.4c0-1.2.5-2 1.7-2.5Z",
  artist: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2",
  forward: "m9 5 7 7-7 7",
  heart:
    "M20.2 5.8a5 5 0 0 0-7.1 0L12 6.9l-1.1-1.1a5 5 0 0 0-7.1 7.1L12 21l8.2-8.1a5 5 0 0 0 0-7.1Z",
  queue: "M3 5h18M3 11h18M3 17h11M19 15v6m-3-3h6",
  library: "M4 4v16M9 4v16M14 5l5-1 3 15-5 1Z",
  disc: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0M6 12a6 6 0 0 1 6-6",
  repeat:
    "M17 2l4 4-4 4M3 10V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14 0v2a2 2 0 0 1-2 2H3",
  "repeat-one":
    "M17 2l4 4-4 4M3 10V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14 0v2a2 2 0 0 1-2 2H3M10 11l2-1v5",
  shuffle: "M3 5h3l12 14h3M3 19h3L18 5h3m-4-3 4 3-4 3m0 8 4 3-4 3",
  folder: "M3 7V5h6l2 2h10v13H3Z",
  lyrics: "M4 4h16v13H9l-5 4Zm4 5h8m-8 4h5",
  check: "M4 12l5 5L20 6",
  headphones: "M4 14v-2a8 8 0 0 1 16 0v2M4 13h3v7H4v-7Zm16 0h-3v7h3Z",
};
export function Icon({
  name,
  size = 23,
  color = palette.text,
  filled = false,
}: {
  name: string;
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={icons[name] || icons.disc}
        stroke={color}
        strokeWidth={name === "pause" ? 3 : 1.6}
        fill={filled || name === "play" ? color : "none"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function ArtworkImage({ uri, fallback }: { uri?: string; fallback: ImageSourcePropType }) {
  const [failedUri, setFailedUri] = useState<string>();
  return (
    <>
      <Image source={fallback} resizeMode="cover" style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]} accessible={false} />
      {!!uri && failedUri !== uri && (
        <Image
          key={uri}
          source={{ uri }}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          onError={() => setFailedUri(uri)}
          accessible={false}
        />
      )}
    </>
  );
}
export function Cover({
  track,
  size,
  style,
}: {
  track?: Track;
  size?: number;
  style?: any;
}) {
  const uri = artUri(track?.artwork);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          overflow: "hidden",
          borderRadius: 8,
          backgroundColor: "#292c30",
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Icon name="disc" size={size ? size * 0.35 : 48} color="#e2d0ad" />
      <ArtworkImage key={uri || "default"} uri={uri} fallback={placeholderAssets[albumPlaceholder(track)]} />
    </View>
  );
}
export function ArtistAvatar({ artwork, name, size = 34 }: { artwork?: string; name?: string; size?: number }) {
  const uri = artUri(artwork);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        flexShrink: 0,
        backgroundColor: "#d5b78224",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name="artist" size={size * 0.45} color="#e2d0ad" />
      <ArtworkImage key={uri || "default"} uri={uri} fallback={placeholderAssets[artistPlaceholder(name)]} />
    </View>
  );
}
const recordTextures = {
  black: require("../../assets/turntable/black-v2.png"),
  smoke: require("../../assets/turntable/smoke-v2.png"),
  blue: require("../../assets/turntable/blue-v2.png"),
};
// The source PNGs have different transparent margins and embossed rims.
// Map their common inner surface (1152px, centered on the spindle) into one
// circular viewport, so all materials and their tints share the same edge.
const recordCrop = { source: 1254, size: 1152, left: 50, top: 45 };
export const tonearmStyles = {
  simple: {
    name: "简约唱臂",
    description: "纤细金属 · 轻盈长臂",
    image: require("../../assets/turntable/tonearm-slim.png"),
    lightX: 869,
    lightY: 842,
    left: 0.4215,
    top: -0.0481,
    size: 0.957,
    pivot: "90% 9%",
    sweep: 19,
  },
  classic: {
    name: "经典机械",
    description: "金属质感 · 写实细节",
    image: require("../../assets/turntable/tonearm-v2.png"),
    lightX: 823,
    lightY: 801,
    left: 0.42,
    top: -0.022,
    size: 0.86,
    pivot: "85% 15%",
    sweep: 20,
  },
} as const;
// Inset face plates use the original sprite coordinates, leaving edges,
// the needle and (on the mechanical arm) screw slots visible underneath.
const cartridgeFaces = {
  simple:
    "M619 1025 L651 1038 Q658 1041 655 1049 L620 1139 Q618 1147 610 1143 L579 1131 Q572 1128 576 1118 L610 1032 Q613 1023 619 1025Z",
  classic:
    "M620 981 L691 1001 Q698 1003 695 1011 L652 1150 Q650 1157 643 1154 L570 1133 Q564 1131 567 1123 L607 992 Q610 979 620 981Z",
};
const cartridgeSlots =
  "M596 1072 Q604 1074 601 1084 L592 1116 Q588 1129 580 1126 Q571 1123 575 1111 L585 1080 Q588 1069 596 1072Z M656 1089 Q664 1091 661 1101 L652 1133 Q648 1146 640 1143 Q631 1140 635 1128 L645 1097 Q648 1086 656 1089Z";
export function TonearmSprite({
  arm = "simple",
  color = "original",
  size,
  style,
}: {
  arm?: TonearmStyle;
  color?: CartridgeColor;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  const id = useId().replace(/:/g, "");
  const finish = cartridgeColors[color] || cartridgeColors.original;
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Image
        source={tonearmStyles[arm].image}
        resizeMode="contain"
        fadeDuration={0}
        style={[StyleSheet.absoluteFill, { width: size, height: size }]}
      />
      {color !== "original" && (
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 1254 1254"
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <SvgGradient
              id={`${id}-finish`}
              gradientUnits="userSpaceOnUse"
              x1={586}
              y1={arm === "simple" ? 1081 : 1051}
              x2={arm === "simple" ? 643 : 674}
              y2={arm === "simple" ? 1102 : 1077}
            >
              <Stop offset="0" stopColor={finish.highlight} />
              <Stop offset="0.3" stopColor={finish.color} />
              <Stop offset="0.7" stopColor={finish.color} />
              <Stop offset="1" stopColor={finish.shadow} />
            </SvgGradient>
            <Mask
              id={`${id}-face`}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="1254"
              height="1254"
            >
              <Path d={cartridgeFaces[arm]} fill="white" />
              {arm === "classic" && <Path d={cartridgeSlots} fill="black" />}
            </Mask>
          </Defs>
          <Path
            d={cartridgeFaces[arm]}
            fill={`url(#${id}-finish)`}
            opacity={0.94}
            mask={`url(#${id}-face)`}
          />
        </Svg>
      )}
    </View>
  );
}
export const materials: Record<
  RecordStyle,
  {
    name: string;
    texture: number;
    opacity?: number;
    tint?: [string, string, string];
    tintOpacity?: number;
  }
> = {
  black: { name: "纯黑胶", texture: recordTextures.black },
  clear: { name: "烟熏透明", texture: recordTextures.smoke, opacity: 0.88 },
  aurora: { name: "冰蓝反光", texture: recordTextures.blue },
  matte: {
    name: "石墨磨砂",
    texture: recordTextures.black,
    tint: ["#4c5055", "#45484b", "#303337"],
    tintOpacity: 0.3,
  },
  pearl: {
    name: "珠光贝母",
    texture: recordTextures.smoke,
    tint: ["#eee4cf", "#cdd5dc", "#ead9ca"],
    tintOpacity: 0.72,
  },
  dusk: {
    name: "暮色渐变",
    texture: recordTextures.smoke,
    tint: ["#d99c71", "#bb749a", "#575985"],
    tintOpacity: 0.5,
  },
  amber: {
    name: "琥珀透胶",
    texture: recordTextures.smoke,
    tint: ["#e8b663", "#aa642e", "#d79745"],
    tintOpacity: 0.58,
    opacity: 0.86,
  },
  rose: {
    name: "樱花粉胶",
    texture: recordTextures.smoke,
    tint: ["#f2d5de", "#d7a1b9", "#c692a5"],
    tintOpacity: 0.68,
  },
  jade: {
    name: "翡翠流光",
    texture: recordTextures.blue,
    tint: ["#88bea9", "#216b59", "#65b5a0"],
    tintOpacity: 0.52,
  },
};
export function Record({
  track,
  material,
  speed = "standard",
  stylusLight = "ruby",
  tonearmStyle = "simple",
  cartridgeColor = "original",
  size,
  playing = false,
  progress = 0,
  mini = false,
  artworkRatio = 0.46,
}: {
  track?: Track;
  material: RecordStyle;
  speed?: RecordSpeed;
  stylusLight?: StylusLight;
  tonearmStyle?: TonearmStyle;
  cartridgeColor?: CartridgeColor;
  size: number;
  playing?: boolean;
  progress?: number;
  mini?: boolean;
  artworkRatio?: number;
}) {
  const armSkin = tonearmStyles[tonearmStyle] || tonearmStyles.simple;
  const armAngle = playing
    ? Math.max(0, Math.min(1, progress)) * armSkin.sweep
    : -7;
  const [rotation] = useState(() => new Animated.Value(0));
  const [arm] = useState(() => new Animated.Value(armAngle));
  const [light] = useState(() => new Animated.Value(playing && stylusLight !== "off" ? 1 : 0));
  const armMotion = useRef({
    playing,
    progress,
    track: track?.id,
    at: 0,
    dockingUntil: 0,
  });
  const [reduced, setReduced] = useState(false);
  const turnDuration = (recordSpeeds[speed] || recordSpeeds.standard).duration;
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const s = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => s.remove();
  }, []);
  useEffect(() => {
    let alive = true;
    const spin = (from: number) => {
      Animated.timing(rotation, {
        toValue: 1,
        duration: turnDuration * (1 - from),
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }).start(({ finished }) => {
        if (finished && alive) {
          rotation.setValue(0);
          spin(0);
        }
      });
    };
    // Read the presentation value before resuming or changing speed. Native
    // stop callbacks are asynchronous, so ignore callbacks from an old effect.
    rotation.stopAnimation((current) => {
      if (!alive) return;
      const phase = ((current % 1) + 1) % 1;
      rotation.setValue(phase);
      if (playing && !reduced) spin(phase);
    });
    return () => {
      alive = false;
      rotation.stopAnimation();
    };
  }, [playing, reduced, turnDuration, rotation]);
  useEffect(() => {
    const previous = armMotion.current;
    const now = Date.now();
    const docking =
      previous.playing !== playing || previous.track !== track?.id;
    const seeking = Math.abs(progress - previous.progress) > 0.025;
    const interval = previous.at
      ? Math.min(500, Math.max(100, now - previous.at))
      : 0;
    armMotion.current = {
      playing,
      progress,
      track: track?.id,
      at: now,
      dockingUntil: docking ? now + 900 : previous.dockingUntil,
    };
    if (reduced) {
      arm.stopAnimation();
      arm.setValue(armAngle);
      return;
    }
    // Progress events must not restart the landing animation. Once landed,
    // follow the native playback clock linearly, without an ease-out per tick.
    if (!docking && !playing) return;
    if (!docking && !seeking && now < previous.dockingUntil) return;
    Animated.timing(arm, {
      toValue: armAngle,
      duration: docking ? 900 : seeking ? 240 : interval,
      easing: docking || seeking ? Easing.inOut(Easing.cubic) : Easing.linear,
      useNativeDriver: true,
      isInteraction: false,
    }).start();
  }, [playing, progress, reduced, track?.id, arm, armAngle]);
  useEffect(() => () => arm.stopAnimation(), [arm]);
  useEffect(() => {
    const animation = Animated.timing(light, {
      toValue: playing && stylusLight !== "off" ? 1 : 0,
      duration: reduced ? 0 : playing ? 450 : 180,
      delay: reduced || !playing ? 0 : 350,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [playing, stylusLight, reduced, light]);
  const skin = materials[material];
  const diameter = size;
  const surfaceSize = diameter * 0.95;
  // Preserve the centered record and arm geometry across artwork modes.
  const controlGutter = mini ? 0 : 12;
  const discLeft = controlGutter;
  const discTop = mini ? 0 : size * 0.06;
  const lamp = stylusLights[stylusLight] || stylusLights.ruby;
  return (
    <View
      style={{
        width: size + controlGutter * 2,
        height: mini ? size : size * 1.06,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: diameter * 0.94,
          height: diameter * 0.94,
          left: discLeft + diameter * 0.03,
          top: discTop + diameter * 0.03,
          borderRadius: diameter,
          backgroundColor: "#11151b32",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: mini ? 3 : 12 },
          shadowOpacity: 0.28,
          shadowRadius: mini ? 3 : 14,
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          width: diameter,
          height: diameter,
          left: discLeft,
          top: discTop,
          transform: [
            {
              rotate: rotation.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "360deg"],
              }),
            },
          ],
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: diameter * 0.025,
            top: diameter * 0.025,
            width: surfaceSize,
            height: surfaceSize,
            borderRadius: surfaceSize / 2,
            overflow: "hidden",
          }}
        >
          <Image
            source={skin.texture}
            resizeMode="contain"
            fadeDuration={0}
            style={{
              position: "absolute",
              width: (surfaceSize * recordCrop.source) / recordCrop.size,
              height: (surfaceSize * recordCrop.source) / recordCrop.size,
              left: (-surfaceSize * recordCrop.left) / recordCrop.size,
              top: (-surfaceSize * recordCrop.top) / recordCrop.size,
              opacity: skin.opacity ?? 1,
            }}
          />
          {skin.tint && (
            <LinearGradient
              colors={skin.tint}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { opacity: skin.tintOpacity }]}
            />
          )}
        </View>
        <View
          style={{
            position: "absolute",
            left: (diameter * (1 - artworkRatio)) / 2,
            top: (diameter * (1 - artworkRatio)) / 2,
            width: diameter * artworkRatio,
            height: diameter * artworkRatio,
            borderRadius: diameter,
            overflow: "hidden",
            borderWidth: 0.7,
            borderColor: "#090b0e99",
          }}
        >
          <Cover
            track={track}
            style={{ width: "100%", height: "100%", borderRadius: diameter }}
          />
        </View>
        <View
          style={{
            position: "absolute",
            left: "49.4%",
            top: "49.4%",
            width: "1.2%",
            height: "1.2%",
            borderRadius: 6,
            backgroundColor: "#292e31",
            borderWidth: 0.7,
            borderColor: "#d6d9d28c",
          }}
        />
      </Animated.View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: discLeft,
          top: discTop,
          width: diameter,
          height: diameter,
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 1000 1000">
          <Defs>
            <SvgGradient id="surface-light" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#f1f5ff" stopOpacity="0.18" />
              <Stop offset="0.35" stopColor="#f1f5ff" stopOpacity="0" />
              <Stop offset="0.7" stopColor="#f1f5ff" stopOpacity="0" />
              <Stop offset="1" stopColor="#f1f5ff" stopOpacity="0.09" />
            </SvgGradient>
            <Mask id="groove-mask">
              <Circle cx="500" cy="500" r="475" fill="white" />
              <Circle
                cx="500"
                cy="500"
                r={artworkRatio * 500 + 5}
                fill="black"
              />
            </Mask>
          </Defs>
          <Circle
            cx="500"
            cy="500"
            r="475"
            fill="url(#surface-light)"
            mask="url(#groove-mask)"
          />
        </Svg>
      </View>
      {!mini && (
        <>
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: size,
              height: size,
              left: discLeft,
              top: 0,
              transformOrigin: armSkin.pivot,
              transform: [
                {
                  rotate: arm.interpolate({
                    inputRange: [-30, 40],
                    outputRange: ["-30deg", "40deg"],
                  }),
                },
              ],
            }}
          >
            <Animated.View
              style={[StyleSheet.absoluteFill, { opacity: light }]}
            >
              <Svg width="100%" height="100%" viewBox="0 0 1000 1000">
                <Defs>
                  <RadialGradient
                    id="stylus-light"
                    gradientUnits="userSpaceOnUse"
                    cx={armSkin.lightX}
                    cy={armSkin.lightY}
                    r="125"
                  >
                    <Stop
                      offset="0"
                      stopColor={lamp.color}
                      stopOpacity="0.65"
                    />
                    <Stop
                      offset="0.22"
                      stopColor={lamp.color}
                      stopOpacity="0.35"
                    />
                    <Stop offset="1" stopColor={lamp.color} stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Circle
                  cx={armSkin.lightX}
                  cy={armSkin.lightY}
                  r="125"
                  fill="url(#stylus-light)"
                />
              </Svg>
            </Animated.View>
            <TonearmSprite
              arm={tonearmStyle}
              color={cartridgeColor}
              size={size * armSkin.size}
              style={{
                position: "absolute",
                left: size * armSkin.left,
                top: size * armSkin.top,
                width: size * armSkin.size,
                height: size * armSkin.size,
                shadowColor: "#000",
                shadowOffset:
                  tonearmStyle === "simple"
                    ? { width: 1, height: 2 }
                    : { width: 2, height: 4 },
                shadowRadius: tonearmStyle === "simple" ? 1 : 3,
                shadowOpacity: 0.3,
              }}
            />
          </Animated.View>
        </>
      )}
    </View>
  );
}
