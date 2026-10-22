import React, { memo, useEffect, useId, useState } from "react";
import { Animated, StyleSheet, Text, type TextLayoutEvent } from "react-native";
import Svg, {
  Defs,
  G,
  Filter,
  FeGaussianBlur,
  Text as SvgText,
} from "react-native-svg";

/** Blur only the small text surface; never sample/blur the whole screen per row. */
export const FocusedLyricLine = memo(function FocusedLyricLine({
  text,
  fontSize,
  lineHeight,
  fontScale,
  blur,
  opacity,
  reduced,
}: {
  text: string;
  fontSize: number;
  lineHeight: number;
  fontScale: number;
  blur: number;
  opacity: number;
  reduced: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [lines, setLines] = useState<TextLayoutEvent["nativeEvent"]["lines"]>(
    [],
  );
  const [sharp] = useState(() => new Animated.Value(blur === 0 ? 1 : 0));
  const [strength] = useState(() => new Animated.Value(opacity));
  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(sharp, {
        toValue: blur === 0 ? 1 : 0,
        duration: reduced ? 0 : 280,
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.timing(strength, {
        toValue: opacity,
        duration: reduced ? 0 : 280,
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [blur, opacity, reduced, sharp, strength]);
  return (
    <Animated.View style={{ opacity: strength }} pointerEvents="none">
      <Animated.View style={{ opacity: sharp }}>
        <Text
          style={{
            fontSize,
            lineHeight,
            fontWeight: "700",
            color: "#fff",
            includeFontPadding: false,
          }}
          onLayout={({ nativeEvent: { layout } }) =>
            setSize((old) =>
              old.width === layout.width && old.height === layout.height
                ? old
                : { width: layout.width, height: layout.height },
            )
          }
          onTextLayout={({ nativeEvent }) =>
            setLines((old) =>
              JSON.stringify(old) === JSON.stringify(nativeEvent.lines)
                ? old
                : nativeEvent.lines,
            )
          }
        >
          {text}
        </Text>
      </Animated.View>
      {size.width > 0 && lines.length > 0 && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: sharp.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
            },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Svg width={size.width} height={size.height} accessible={false}>
            <Defs>
              <Filter id={id} x="-5%" y="-30%" width="110%" height="160%">
                <FeGaussianBlur stdDeviation={blur || 1.2} />
              </Filter>
            </Defs>
            <G filter={`url(#${id})`}>
              {lines.map((line, index) => (
                <SvgText
                  key={index}
                  x={line.x}
                  y={line.y + line.ascender}
                  fontSize={fontSize * fontScale}
                  fontWeight="700"
                  fill="#fff"
                >
                  {line.text}
                </SvgText>
              ))}
            </G>
          </Svg>
        </Animated.View>
      )}
    </Animated.View>
  );
});
