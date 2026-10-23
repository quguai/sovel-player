import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMusic } from "../services/store";
import {
  stylusLights,
  recordSpeeds,
  type PlayerStyle,
  type RecordSpeed,
  type RecordStyle,
  type TonearmStyle,
  type StylusLight,
} from "../core/types";
import { Action } from "./components";
import {
  Cover,
  Icon,
  Record,
  materials,
  tonearmStyles,
  TonearmSprite,
} from "./visuals";
import { CartridgeColorOptions } from "./CartridgeColorOptions";

export function PlayerAppearanceSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { prefs, preferences, current } = useMusic();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => listener.remove();
  }, []);
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? "none" : "slide"}
      supportedOrientations={["portrait", "landscape"]}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="收起播放外观"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              maxHeight: height * (width > height ? 0.92 : 0.57),
              width: width > height ? Math.min(420, width * 0.52) : "100%",
              alignSelf: "flex-end",
              paddingBottom: Math.max(16, insets.bottom),
              paddingLeft: 18,
              paddingRight: Math.max(18, insets.right),
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>播放外观</Text>
            <Action
              icon="down"
              label="收起播放外观面板"
              onPress={onClose}
              color="#f4f0eb"
            />
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.section}>播放画面</Text>
            <View style={styles.row}>
              {(
                [
                  ["cover", "专辑封面"],
                  ["vinyl", "唱片"],
                  ["immersive", "沉浸大图"],
                ] as [PlayerStyle, string][]
              ).map(([key, name]) => (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityLabel={`播放画面：${name}`}
                  accessibilityState={{ selected: prefs.player === key }}
                  onPress={() => preferences({ player: key })}
                  style={[styles.mode, prefs.player === key && styles.selected]}
                >
                  <View style={styles.modeArt}>
                    {key === "vinyl" ? (
                      <Record
                        track={current}
                        material={prefs.record}
                        size={48}
                        mini
                      />
                    ) : (
                      <Cover
                        track={current}
                        size={key === "cover" ? 42 : 56}
                        style={{
                          borderRadius: 6,
                          opacity: key === "immersive" ? 0.65 : 1,
                        }}
                      />
                    )}
                    {key === "immersive" && (
                      <View style={styles.immersiveIcon}>
                        <Icon name="play" size={18} />
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.label,
                      prefs.player === key && styles.selectedText,
                    ]}
                  >
                    {name}
                  </Text>
                </Pressable>
              ))}
            </View>
            {prefs.player === "vinyl" && (
              <>
                <Text style={styles.section}>唱片材质</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.records}
                >
                  {(Object.keys(materials) as RecordStyle[]).map((key) => (
                    <Pressable
                      key={key}
                      accessibilityRole="radio"
                      accessibilityLabel={materials[key].name}
                      accessibilityState={{ selected: prefs.record === key }}
                      onPress={() => preferences({ record: key })}
                      style={styles.recordOption}
                    >
                      <View
                        style={[
                          styles.recordRing,
                          prefs.record === key && styles.selected,
                        ]}
                      >
                        <Record material={key} track={current} size={48} mini />
                      </View>
                      <Text
                        style={[
                          styles.label,
                          prefs.record === key && styles.selectedText,
                        ]}
                      >
                        {materials[key].name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.section}>唱臂</Text>
                <View style={styles.row}>
                  {(Object.keys(tonearmStyles) as TonearmStyle[]).map((key) => (
                    <Pressable
                      key={key}
                      accessibilityRole="radio"
                      accessibilityLabel={`唱臂风格：${tonearmStyles[key].name}`}
                      accessibilityState={{
                        selected: prefs.tonearmStyle === key,
                      }}
                      onPress={() => preferences({ tonearmStyle: key })}
                      style={[
                        styles.armOption,
                        prefs.tonearmStyle === key && styles.selected,
                      ]}
                    >
                      <View style={styles.armPreview}>
                        <TonearmSprite
                          arm={key}
                          color={prefs.cartridgeColor}
                          size={128}
                          style={styles.armImage}
                        />
                      </View>
                      <Text style={styles.armLabel}>
                        {tonearmStyles[key].name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.section}>黑胶转速</Text>
                <View style={styles.row}>
                  {(Object.keys(recordSpeeds) as RecordSpeed[]).map((key) => (
                    <Pressable
                      key={key}
                      accessibilityRole="radio"
                      accessibilityLabel={`黑胶转速：${recordSpeeds[key].name}`}
                      accessibilityState={{
                        selected: prefs.recordSpeed === key,
                      }}
                      onPress={() => preferences({ recordSpeed: key })}
                      style={[
                        styles.speed,
                        prefs.recordSpeed === key && styles.selected,
                      ]}
                    >
                      <Text style={styles.armLabel}>
                        {recordSpeeds[key].name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.section}>唱头颜色</Text>
                <CartridgeColorOptions
                  selected={prefs.cartridgeColor}
                  onChange={(cartridgeColor) => preferences({ cartridgeColor })}
                />
                <Text style={styles.section}>唱头灯光</Text>
                <View style={styles.row}>
                  {(Object.keys(stylusLights) as StylusLight[]).map((key) => (
                    <Pressable
                      key={key}
                      accessibilityRole="radio"
                      accessibilityLabel={`唱头灯光：${stylusLights[key].name}`}
                      accessibilityState={{
                        selected: prefs.stylusLight === key,
                      }}
                      onPress={() => preferences({ stylusLight: key })}
                      style={[
                        styles.lightOption,
                        prefs.stylusLight === key && styles.selected,
                      ]}
                    >
                      <View
                        style={{
                          width: 15,
                          height: 15,
                          borderRadius: 8,
                          backgroundColor:
                            key === "off"
                              ? "transparent"
                              : stylusLights[key].color,
                          borderColor: stylusLights[key].color,
                          borderWidth: 1,
                        }}
                      />
                      <Text style={styles.label}>{stylusLights[key].name}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#00000012",
  },
  sheet: {
    backgroundColor: "#292b32",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: "#f5f1ed", fontSize: 17, fontWeight: "600" },
  section: { color: "#f5f1edb3", fontSize: 11, marginBottom: 9, marginTop: 10 },
  records: { gap: 6, paddingBottom: 4 },
  recordOption: { width: 64, alignItems: "center", gap: 7 },
  recordRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  selected: { borderColor: "#f4ece2", backgroundColor: "#ffffff0c" },
  label: { fontSize: 10, color: "#f4eee4aa" },
  selectedText: { color: "#f4eee4" },
  row: { flexDirection: "row", gap: 9 },
  mode: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ffffff18",
  },
  modeArt: { height: 56, alignItems: "center", justifyContent: "center" },
  immersiveIcon: { position: "absolute" },
  speed: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ffffff18",
    marginBottom: 6,
  },
  armOption: {
    flex: 1,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ffffff18",
  },
  armPreview: { width: 32, height: 38, overflow: "hidden" },
  armImage: {
    position: "absolute",
    width: 128,
    height: 128,
    left: -45,
    top: -90,
  },
  armLabel: { fontSize: 12, color: "#f4eee4" },
  lightOption: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ffffff18",
  },
});
