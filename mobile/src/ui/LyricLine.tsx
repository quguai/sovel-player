import React, { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Text,
  View,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { singleLineLyric } from "../core/lyrics";

/** Measure the complete line, then translate it inside a clipped viewport. */
export function LyricLine({
  text,
  style,
  active = true,
  centered = false,
}: {
  text: string;
  style: StyleProp<TextStyle>;
  active?: boolean;
  centered?: boolean;
}) {
  const [offset] = useState(() => new Animated.Value(0));
  const [viewportWidth, setViewportWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const value = singleLineLyric(text);
  const font = StyleSheet.flatten(style);
  // A roomy measurement lane prevents native Text from reporting only the
  // viewport width. It is invisible, excluded from layout and accessibility.
  const measurementWidth = Math.max(
    viewportWidth,
    value.length *
      ((font?.fontSize ?? 14) + Math.abs(font?.letterSpacing ?? 0)) *
      fontScale *
      2,
  );
  const overflow = Math.max(0, textWidth - viewportWidth);

  useEffect(() => {
    offset.setValue(0);
    if (!active || viewportWidth === 0 || overflow <= 1) return;
    const duration = Math.max(1200, (overflow / 28) * 1000);
    const travel = (toValue: number) =>
      Animated.timing(offset, {
        toValue,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      });
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(1000),
        travel(-overflow),
        Animated.delay(1400),
        travel(0),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [active, offset, overflow, text, viewportWidth]);

  return (
    <View
      pointerEvents="none"
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      style={styles.viewport}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.measurement}
      >
        <Text
          accessible={false}
          numberOfLines={1}
          style={[style, { width: measurementWidth }]}
          onTextLayout={(event) => {
            const width = Math.ceil(event.nativeEvent.lines[0]?.width ?? 0);
            setTextWidth((previous) => (previous === width ? previous : width));
          }}
        >
          {value}
        </Text>
      </View>
      <Animated.Text
        accessibilityLabel={value}
        numberOfLines={1}
        ellipsizeMode="clip"
        style={[
          style,
          styles.text,
          {
            width: Math.max(viewportWidth, textWidth),
            textAlign: centered && overflow <= 1 ? "center" : "left",
            transform: [{ translateX: offset }],
          },
        ]}
      >
        {value}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { width: "100%", flexGrow: 0, flexShrink: 0, overflow: "hidden" },
  measurement: {
    position: "absolute",
    opacity: 0,
    height: 0,
    overflow: "hidden",
  },
  text: { flexShrink: 0 },
});
