import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { cartridgeColors, type CartridgeColor } from "../core/types";
import { Icon } from "./visuals";

export function CartridgeColorOptions({
  selected,
  onChange,
  accent = "#f4ece2",
}: {
  selected: CartridgeColor;
  onChange: (color: CartridgeColor) => void;
  accent?: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
    >
      {(Object.keys(cartridgeColors) as CartridgeColor[]).map((key) => {
        const color = cartridgeColors[key];
        const active = selected === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityLabel={`唱头颜色：${color.name}`}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(key)}
            style={{ width: 48, minHeight: 60, alignItems: "center", gap: 6 }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: active ? accent : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LinearGradient
                colors={[color.highlight, color.color, color.shadow]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 0.5,
                  borderColor: "#ffffff30",
                }}
              >
                {active && (
                  <Icon
                    name="check"
                    size={14}
                    color={
                      key === "silver" || key === "gold" || key === "ice"
                        ? "#20242a"
                        : "#fff"
                    }
                  />
                )}
              </LinearGradient>
            </View>
            <Text
              style={{ fontSize: 10, color: active ? accent : "#f4eee4aa" }}
            >
              {color.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
