import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  type GestureResponderHandlers,
} from "react-native";
import { shouldDismissPlayer } from "../core/playerDismiss";

export function DismissiblePlayer({
  onClose,
  children,
}: {
  onClose: () => void;
  children: (
    dismiss: () => void,
    panHandlers: GestureResponderHandlers,
  ) => React.ReactNode;
}) {
  const { height } = useWindowDimensions();
  const [y] = useState(() => new Animated.Value(0));
  const [reduced, setReduced] = useState(true);
  const drag = useRef({ start: 0, multiTouch: false });
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    y.stopAnimation();
    y.setValue(0);
    return () => y.stopAnimation();
  }, [height, y]);
  const dismiss = useCallback(() => {
    Animated.timing(y, {
      toValue: height,
      duration: reduced ? 0 : 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [height, reduced, onClose, y]);
  const responder = useMemo(() => {
    const settle = () => {
      Animated.spring(y, {
        toValue: 0,
        stiffness: 240,
        damping: 30,
        mass: 0.8,
        useNativeDriver: true,
        isInteraction: false,
      }).start();
    };
    // PanResponder stores event callbacks without reading refs during render.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        gesture.numberActiveTouches === 1 &&
        gesture.dy > 12 &&
        gesture.dy > Math.abs(gesture.dx) * 1.5,
      onPanResponderGrant: () => {
        drag.current.multiTouch = false;
        y.stopAnimation((value) => {
          drag.current.start = value;
        });
      },
      onPanResponderStart: (_, gesture) => {
        if (gesture.numberActiveTouches > 1) drag.current.multiTouch = true;
      },
      onPanResponderMove: (_, gesture) => {
        if (gesture.numberActiveTouches > 1) drag.current.multiTouch = true;
        if (!drag.current.multiTouch)
          y.setValue(
            Math.max(0, Math.min(height, drag.current.start + gesture.dy)),
          );
      },
      onPanResponderRelease: (_, gesture) => {
        if (
          !drag.current.multiTouch &&
          shouldDismissPlayer(gesture.dx, gesture.dy, height)
        )
          dismiss();
        else settle();
      },
      onPanResponderTerminate: settle,
      onPanResponderTerminationRequest: () => false,
    });
  }, [dismiss, height, y]);
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: "#292633", transform: [{ translateY: y }] },
      ]}
      accessibilityViewIsModal
      testID="dismissible-player"
    >
      {children(dismiss, responder.panHandlers)}
    </Animated.View>
  );
}
