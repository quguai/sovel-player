import { themeStyles } from "./themeStyles";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { palette as p } from "./visuals";

export function StartupScreen({
  stage,
  error,
  onRetry,
}: {
  stage: string;
  error: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.screen} testID="startup-screen">
      <View style={styles.brand}>
        <Image source={require("../../assets/icon.png")} style={styles.logo} />
        <Text style={styles.name}>Sovel</Text>
        <Text style={styles.caption}>留一点时间，给音乐。</Text>
      </View>
      <View style={styles.status} accessibilityLiveRegion="polite">
        {!error && <ActivityIndicator color={p.gold} size="small" />}
        <Text style={styles.stage}>{error ? `未能完成：${stage}` : stage}</Text>
        {error ? (
          <>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              style={({ pressed }) => [
                styles.retry,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={styles.retryLabel}>重新尝试</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.note}>正在恢复你的音乐空间</Text>
        )}
      </View>
    </View>
  );
}

const styles = themeStyles(() => ({
  screen: {
    flex: 1,
    padding: 32,
    justifyContent: "center",
    backgroundColor: p.bg,
  },
  brand: { alignItems: "center", marginBottom: 64 },
  logo: { width: 88, height: 88, borderRadius: 22, marginBottom: 22 },
  name: { color: p.text, fontSize: 34, fontWeight: "600", letterSpacing: 3 },
  caption: { color: p.gold, fontSize: 13, marginTop: 12, letterSpacing: 2 },
  status: { alignItems: "center", minHeight: 130, gap: 12 },
  stage: { color: p.text, fontSize: 14, textAlign: "center" },
  note: { color: p.muted, fontSize: 12 },
  error: { color: p.muted, fontSize: 13, lineHeight: 21, textAlign: "center" },
  retry: {
    minHeight: 46,
    paddingHorizontal: 28,
    justifyContent: "center",
    borderRadius: 23,
    borderWidth: 1,
    borderColor: p.gold,
    marginTop: 8,
  },
  retryLabel: { color: p.gold, fontSize: 14, fontWeight: "600" },
}));
