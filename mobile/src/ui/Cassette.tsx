import { memo, useEffect, useId, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  FeColorMatrix,
  Filter,
  G,
  Image as SvgImage,
  Mask,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { cassetteStyles, tapeRadius } from "../core/cassette";
import type { CassetteStyle, Track } from "../core/types";
import { useMusic, usePlaybackProgress } from "../services/store";

const shells = {
  noir: require("../../assets/cassette/noir-shell-v2.png"),
  classic: require("../../assets/cassette/classic-shell-v5.png"),
  studio: require("../../assets/cassette/studio-shell-v5.png"),
  pop: require("../../assets/cassette/pop-shell-v5.png"),
};
const metalHub = require("../../assets/cassette/noir-hub-v2.png");
const geometry = {
  noir: {
    left: 120.5,
    right: 297,
    y: 123.5,
    outer: 63,
    hub: 23,
    tape: "#493d31",
    spool: "#c5ced1",
    ink: "#e6edf0",
    titleX: 40,
    titleY: 57,
    artistY: 68,
    size: 11,
  },
  classic: {
    left: 120.3,
    right: 298.1,
    y: 128.8,
    outer: 24.5,
    hub: 12,
    tape: "#483b2e",
    spool: "#e6e1d6",
    ink: "#292a27",
    titleX: 51,
    titleY: 84,
    artistY: 177,
    size: 12.5,
  },
  studio: {
    left: 129.5,
    right: 291.4,
    y: 130.5,
    outer: 37,
    hub: 15,
    tape: "#353e43",
    spool: "#b9c5c9",
    ink: "#202c32",
    titleX: 57,
    titleY: 82,
    artistY: 178,
    size: 13,
  },
  pop: {
    left: 129.3,
    right: 290.6,
    y: 137.5,
    outer: 28.5,
    hub: 13,
    tape: "#27435a",
    spool: "#e7e6dc",
    ink: "#122e46",
    titleX: 88,
    titleY: 66,
    artistY: 88,
    size: 23,
  },
};

export function useCassetteMotion(active: boolean) {
  const [reduced, setReduced] = useState(true);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduced(value);
      })
      .catch(() => {});
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    const app = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => {
      alive = false;
      motion.remove();
      app.remove();
    };
  }, []);
  return { reduced, moving: active && foreground && !reduced };
}

/** Only the lightweight reels subscribe to the native clock; the shell stays memoized. */
export function PlayingCassette({
  width,
  active,
  track,
}: {
  width: number;
  active: boolean;
  track: Track;
}) {
  const { prefs } = useMusic();
  const status = usePlaybackProgress();
  return (
    <Cassette
      width={width}
      finish={prefs.cassette}
      title={track.title}
      artist={track.artist}
      playing={active && status.playing}
      progress={status.currentTime / (status.duration || track.duration || 1)}
    />
  );
}

export function Cassette({
  width,
  finish,
  title = "",
  artist = "",
  playing = false,
  progress = 0.35,
}: {
  width: number;
  finish: CassetteStyle;
  title?: string;
  artist?: string;
  playing?: boolean;
  progress?: number;
}) {
  const scale = width / 420;
  const g = geometry[finish];
  const { moving } = useCassetteMotion(playing);
  const [phase] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let alive = true;
    const spin = (from: number) => {
      Animated.timing(phase, {
        toValue: 1,
        duration: 7000 * (1 - from),
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }).start(({ finished }) => {
        if (finished && alive) {
          phase.setValue(0);
          spin(0);
        }
      });
    };
    phase.stopAnimation((value) => {
      if (alive && moving) spin(value % 1);
    });
    return () => {
      alive = false;
      phase.stopAnimation();
    };
  }, [moving, phase]);
  const rotation = phase.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const hubs = [g.left, g.right].map((x) => (
    <Animated.View
      key={x}
      style={{
        position: "absolute",
        left: (x - g.hub) * scale,
        top: (g.y - g.hub) * scale,
        width: g.hub * 2 * scale,
        height: g.hub * 2 * scale,
        transform: [{ rotate: rotation }],
      }}
    >
      <Hub finish={finish} />
    </Animated.View>
  ));
  return (
    <View
      accessible
      accessibilityLabel={`${cassetteStyles.find((s) => s.id === finish)?.name}磁带${title ? `，${title}` : ""}`}
      style={{ width, height: (width * 270) / 420 }}
      pointerEvents="none"
    >
      <TapePacks finish={finish} progress={progress} />
      {finish !== "noir" && hubs}
      <Shell finish={finish} title={title} artist={artist} />
      {finish === "noir" && hubs}
    </View>
  );
}

const Hub = memo(function Hub({ finish }: { finish: CassetteStyle }) {
  const id = useId().replace(/:/g, "");
  const g = geometry[finish];
  return (
    <Svg width="100%" height="100%" viewBox="-24 -24 48 48">
      {finish === "noir" ? (
        <>
          <Defs>
            <Filter id={id}>
              <FeColorMatrix type="saturate" values="0" />
            </Filter>
          </Defs>
          <SvgImage
            href={metalHub}
            x={-24}
            y={-24}
            width={48}
            height={48}
            filter={`url(#${id})`}
          />
        </>
      ) : (
        <>
          <Circle r={23} fill={g.spool} stroke="#879095" strokeWidth={0.8} />
          <Circle r={15} fill="#172127" />
          {Array.from({ length: 6 }, (_, i) => (
            <Rect
              key={i}
              x={-2.5}
              y={-20}
              width={5}
              height={10}
              rx={1.4}
              fill={g.spool}
              rotation={i * 60}
            />
          ))}
          <Circle r={6.5} fill={g.spool} />
        </>
      )}
    </Svg>
  );
});

function TapePacks({
  finish,
  progress,
}: {
  finish: CassetteStyle;
  progress: number;
}) {
  const g = geometry[finish];
  const id = useId().replace(/:/g, "");
  const fraction = Number.isFinite(progress)
    ? Math.max(0, Math.min(1, progress))
    : 0;
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 420 270"
    >
      <Defs>
        <ClipPath id={`${id}-inside`}>
          <Rect x={45} y={73} width={330} height={125} rx={18} />
        </ClipPath>
      </Defs>
      {finish === "noir" ? (
        <Rect
          x={8}
          y={14}
          width={404}
          height={238}
          rx={17}
          fill="#171d1b"
          opacity={0.7}
        />
      ) : (
        <Rect x={35} y={95} width={350} height={80} fill="#151e23" />
      )}
      <G clipPath={finish === "noir" ? `url(#${id}-inside)` : undefined}>
        {[g.left, g.right].map((x, side) => {
          const radius = tapeRadius(
            side ? fraction : 1 - fraction,
            g.hub + 2,
            g.outer,
          );
          return (
            <G key={x} transform={`translate(${x} ${g.y})`}>
              <Defs>
                <ClipPath id={`${id}-${side}`}>
                  <Circle r={radius} />
                </ClipPath>
              </Defs>
              <Circle r={g.outer + 2} fill="#10181c" />
              <Circle
                r={radius}
                fill={g.tape}
                stroke="#817768"
                strokeWidth={0.5}
              />
              <G clipPath={`url(#${id}-${side})`}>
                {Array.from({ length: 24 }, (_, i) => (
                  <Circle
                    key={i}
                    r={g.hub + 2 + (i * (g.outer - g.hub - 2)) / 23}
                    fill="none"
                    stroke="#d6c9b0"
                    opacity={0.23}
                    strokeWidth={0.35}
                  />
                ))}
              </G>
            </G>
          );
        })}
      </G>
    </Svg>
  );
}

const Shell = memo(function Shell({
  finish,
  title,
  artist,
}: {
  finish: CassetteStyle;
  title: string;
  artist: string;
}) {
  const id = useId().replace(/:/g, "");
  const g = geometry[finish];
  const noir = finish === "noir";
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 420 270"
    >
      <Defs>
        <Filter id={`${id}-silver`}>
          <FeColorMatrix type="saturate" values="0" />
        </Filter>
        <RadialGradient id={`${id}-alpha`}>
          <Stop offset="0.7" stopColor="white" />
          <Stop offset="0.79" stopColor="#737373" />
          <Stop offset="0.95" stopColor="#898989" />
          <Stop offset="1" stopColor="white" />
        </RadialGradient>
        <Mask id={`${id}-mask`}>
          <Rect width={420} height={270} fill="white" />
          {[g.left, g.right].map((x) => (
            <Circle key={x} cx={x} cy={g.y} r={65} fill={`url(#${id}-alpha)`} />
          ))}
          <Rect x={20} y={29} width={380} height={42} fill="white" />
        </Mask>
        <ClipPath id={`${id}-title`}>
          <Rect
            x={g.titleX}
            y={g.titleY - 25}
            width={380 - g.titleX}
            height={35}
          />
        </ClipPath>
        <ClipPath id={`${id}-artist`}>
          <Rect
            x={g.titleX}
            y={g.artistY - 10}
            width={finish === "studio" ? 240 : 300}
            height={14}
          />
        </ClipPath>
      </Defs>
      <SvgImage
        href={shells[finish]}
        width={420}
        height={270}
        preserveAspectRatio="none"
        filter={noir ? `url(#${id}-silver)` : undefined}
        mask={noir ? `url(#${id}-mask)` : undefined}
      />
      <SvgText
        x={g.titleX}
        y={g.titleY}
        fill={g.ink}
        fontSize={title.length > 18 ? Math.min(g.size, 12) : g.size}
        fontWeight="600"
        clipPath={`url(#${id}-title)`}
      >
        {title}
      </SvgText>
      <SvgText
        x={g.titleX}
        y={g.artistY}
        fill={g.ink}
        opacity={0.75}
        fontSize={noir ? 7 : 9}
        clipPath={`url(#${id}-artist)`}
      >
        {artist}
      </SvgText>
      {noir && (
        <SvgText x={40} y={41} fill="#b1bcc2" fontSize={5.2} letterSpacing={2}>
          SOVEL / CHROME · 60
        </SvgText>
      )}
    </Svg>
  );
});

export function CassetteOptions() {
  const { prefs, preferences } = useMusic();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {cassetteStyles.map(({ id, name }) => (
        <Pressable
          key={id}
          accessibilityRole="radio"
          accessibilityLabel={name}
          accessibilityState={{ selected: prefs.cassette === id }}
          onPress={() => preferences({ cassette: id })}
          style={{
            width: "48%",
            flexGrow: 1,
            alignItems: "center",
            paddingVertical: 8,
            gap: 5,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: prefs.cassette === id ? "#d6c29b" : "#ffffff16",
            backgroundColor: "#ffffff06",
          }}
        >
          <Cassette width={92} finish={id} />
          <Text
            style={{
              color: prefs.cassette === id ? "#e9d7b4" : "#bcb7b0",
              fontSize: 12,
            }}
          >
            {name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
