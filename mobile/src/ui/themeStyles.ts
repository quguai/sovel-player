import {
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type ImageStyle,
} from "react-native";
import { themeKey } from "../core/theme";
// Cache style factories once per palette change, instead of recreating all
// style objects during playback progress renders. Access occurs during render.
type Styles<T> = { [K in keyof T]: ViewStyle | TextStyle | ImageStyle };
export function themeStyles<T extends Styles<T>>(
  factory: () => T & Record<string, ViewStyle | TextStyle | ImageStyle>,
): T {
  let key = themeKey(),
    cached = StyleSheet.create(factory());
  const styles = {} as T;
  for (const name of Object.keys(cached) as (keyof T)[])
    Object.defineProperty(styles, name, {
      enumerable: true,
      get() {
        if (key !== themeKey()) {
          key = themeKey();
          cached = StyleSheet.create(factory());
        }
        return cached[name];
      },
    });
  return styles;
}
