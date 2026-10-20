import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { Directory, File } from "expo-file-system";
import type { DirectoryChild } from "../core/directoryScan";
import { isAudio } from "../core/types";
type Grant = { uri: string; name: string; bookmark?: string };
const native = requireOptionalNativeModule<{
  pick(directory: boolean): Promise<Grant[]>;
  restore(bookmark: string): Promise<Grant>;
  listDirectory?(uri: string): Promise<DirectoryChild[]>;
}>("SovelAccess");
export async function readDirectory(uri: string): Promise<DirectoryChild[]> {
  if (native?.listDirectory) return native.listDirectory(uri);
  // Old installed binaries remain usable, but need a native rebuild for parallel I/O.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return new Directory(uri).list().map((child) => {
    const directory = child instanceof Directory;
    const info = !directory && isAudio(child.name) ? child.info() : undefined;
    if (info && !info.exists)
      throw new Error(`文件暂时不可访问：${child.name}`);
    return {
      name: child.name,
      uri: child.uri,
      directory,
      size: info?.size ?? 0,
      mtime: info?.modificationTime ?? 0,
    };
  });
}
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
