import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  backupMaxBytes,
  createSettingsBackup,
  parseSettingsBackup,
} from "../core/settingsBackup";
import type { Preferences } from "../core/types";

export async function exportSettings(prefs: Preferences) {
  const folder = new Directory(Paths.document, "Backups");
  folder.create({ idempotent: true, intermediates: true });
  const file = new File(folder, `Sovel-settings-${Date.now()}.json`);
  file.write(JSON.stringify(createSettingsBackup(prefs), null, 2));
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("当前设备不支持分享备份文件");
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    UTI: "public.json",
    dialogTitle: "保存 Sovel HiFi 设置备份",
  });
}
export async function pickSettingsBackup() {
  const result = await File.pickFileAsync({ mimeTypes: ["application/json"] });
  if (result.canceled) return null;
  const file = result.result;
  if (file.size > backupMaxBytes) throw new Error("备份文件超过 1 MB");
  return { backup: parseSettingsBackup(await file.text()), name: file.name };
}
