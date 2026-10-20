import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useMusic } from "../services/store";
import { exportSettings, pickSettingsBackup } from "../services/settingsBackup";
import type { SettingsBackup } from "../core/settingsBackup";
import { Button } from "./components";
import { palette as p } from "./visuals";

export function BackupSettings() {
  const { prefs, restoreSettings } = useMusic();
  const [pending, setPending] = useState<{
    backup: SettingsBackup;
    name: string;
  } | null>(null);
  const [working, setWorking] = useState(false),
    [message, setMessage] = useState("");
  const run = async (action: () => Promise<void>) => {
    if (working) return;
    setWorking(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  };
  return (
    <View style={{ gap: 18 }}>
      <Text style={s.heading}>把习惯，一起带走。</Text>
      <Text style={s.note}>
        备份外观、播放偏好、扫描规则、十段均衡器和自定义预设。生成本地备份，通过系统分享保存。
      </Text>
      <View style={s.card}>
        <Text style={s.title}>设置与音色</Text>
        <Text style={s.note}>
          {prefs.equalizer.userPresets.length} 个自定义 EQ 预设 ·
          包含卡片／列表偏好
        </Text>
        <Button
          disabled={working}
          onPress={() =>
            run(async () => {
              await exportSettings(prefs);
              setMessage("备份文件已生成，可通过系统分享保存");
            })
          }
        >
          导出设置备份
        </Button>
        <Button
          secondary
          disabled={working}
          onPress={() =>
            run(async () => setPending(await pickSettingsBackup()))
          }
        >
          选择备份文件
        </Button>
      </View>
      {pending && (
        <View style={s.card} accessibilityLabel="备份导入预览">
          <Text style={s.title}>准备恢复</Text>
          <Text style={s.note}>{pending.name}</Text>
          <Text style={s.note}>
            {new Date(pending.backup.createdAt).toLocaleString()} ·{" "}
            {pending.backup.settings.equalizer.userPresets.length} 个自定义预设
          </Text>
          <Text style={s.note}>
            将替换当前外观、播放偏好、扫描规则和 EQ
            预设。音乐、收藏、播放位置及本曲歌词偏移保留。
          </Text>
          <Button
            disabled={working}
            onPress={() =>
              run(async () => {
                await restoreSettings(pending.backup.settings);
                setPending(null);
                setMessage("设置与预设已恢复");
              })
            }
          >
            恢复这些设置
          </Button>
          <Button secondary disabled={working} onPress={() => setPending(null)}>
            取消恢复
          </Button>
        </View>
      )}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={s.message}>
          {message}
        </Text>
      )}
      <Text style={s.note}>
        备份不包含音频、曲库数据库或文件访问权限。跨设备使用时，需要重新授权音乐来源。
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  heading: {
    color: p.text,
    fontSize: 24,
    fontWeight: "600",
    marginVertical: 6,
  },
  card: {
    backgroundColor: "#ffffff05",
    padding: 18,
    borderRadius: 18,
    gap: 16,
  },
  title: { color: p.text, fontSize: 16, fontWeight: "600" },
  note: { color: p.muted, fontSize: 12, lineHeight: 21 },
  message: { color: p.gold, fontSize: 13, lineHeight: 21 },
});
