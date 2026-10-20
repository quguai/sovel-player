import React, { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type TextStyle,
} from "react-native";

/** An unconstrained text row inside a clipped viewport; never ellipsizes. */
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
    <ScrollView
      horizontal
      scrollEnabled={false}
      pointerEvents="none"
      showsHorizontalScrollIndicator={false}
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      style={styles.viewport}
      contentContainerStyle={[
        styles.content,
        centered && overflow <= 1 && styles.centered,
      ]}
    >
      <Animated.Text
        accessibilityLabel={text}
        onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)}
        style={[style, styles.text, { transform: [{ translateX: offset }] }]}
      >
        {text.replace(/[\r\n]+/g, " ")}
      </Animated.Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  viewport: { width: "100%", flexGrow: 0, flexShrink: 0, overflow: "hidden" },
  content: { flexGrow: 1 },
  centered: { justifyContent: "center" },
  text: { flexShrink: 0 },
});
