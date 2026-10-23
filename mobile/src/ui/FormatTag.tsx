import { StyleSheet, Text, View } from "react-native";

const formatColors: Record<string, string> = {
  FLAC: "#bdd6ba",
  WAV: "#b9ccdf",
  WAVE: "#b9ccdf",
  AIFF: "#b9ccdf",
  DSF: "#e1c38a",
  DFF: "#e1c38a",
  DSD: "#e1c38a",
  ALAC: "#cdbbdd",
  APE: "#dab99d",
};

export function FormatTag({ format }: { format: string }) {
  const label = format.trim().toUpperCase() || "AUDIO";
  const color = formatColors[label] || "#c2c4ca";
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Text numberOfLines={1} style={[styles.label, { color }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 0.5,
  },
  label: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.2,
    lineHeight: 11,
  },
});
