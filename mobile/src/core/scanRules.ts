import { defaultScanRules, type Entry, type ScanRules } from "./types";

export function normalizeScanRules(value: Partial<ScanRules> = {}): ScanRules {
  const size = Number(value.minSizeKB);
  return {
    filterSmall: value.filterSmall ?? defaultScanRules.filterSmall,
    minSizeKB: Number.isFinite(size)
      ? Math.min(1048576, Math.max(1, Math.round(size)))
      : defaultScanRules.minSizeKB,
    ignoreHidden: value.ignoreHidden ?? defaultScanRules.ignoreHidden,
    includeSubfolders:
      value.includeSubfolders ?? defaultScanRules.includeSubfolders,
  };
}

// Paths are relative to the user-authorized root, never opaque SAF document URIs.
export function excludesPath(path: string, rules: ScanRules): boolean {
  const segments = path.split("/").filter(Boolean);
  return (
    (!rules.includeSubfolders && segments.length > 1) ||
    (rules.ignoreHidden && segments.some((part) => part.startsWith(".")))
  );
}

export function excludesEntry(
  entry: Pick<Entry, "path" | "size">,
  rules: ScanRules,
): boolean {
  return (
    excludesPath(entry.path, rules) ||
    (rules.filterSmall && entry.size < rules.minSizeKB * 1024)
  );
}
