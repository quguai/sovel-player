import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { Directory, File } from "expo-file-system";
type Grant = { uri: string; name: string; bookmark?: string };
const native = requireOptionalNativeModule<{
  pick(directory: boolean): Promise<Grant[]>;
  restore(bookmark: string): Promise<Grant>;
}>("SovelAccess");
export async function pickInPlace(directory: boolean): Promise<Grant[]> {
  if (Platform.OS === "ios") {
    if (!native) throw new Error("请重新编译 iOS 应用以启用原文件访问");
    return native.pick(directory);
  }
  try {
    // Expo's Android picker uses ACTION_OPEN_DOCUMENT(_TREE) and persistable grants.
    if (directory) {
      const dir = await Directory.pickDirectoryAsync();
      return [{ uri: dir.uri, name: dir.name }];
    }
    const result = await File.pickFileAsync({ multipleFiles: true });
    const selected = result.canceled ? [] : result.result;
    return selected.map((file) => ({ uri: file.uri, name: file.name }));
  } catch (error) {
    if (/cancel/i.test(String(error))) return [];
    throw error;
  }
}
export async function restoreAccess(
  bookmark?: string,
): Promise<Grant | undefined> {
  if (Platform.OS !== "ios") return undefined;
  if (!native || !bookmark) throw new Error("需要重新授权，请再次选择此来源");
  return native.restore(bookmark);
}
