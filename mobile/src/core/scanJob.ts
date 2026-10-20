import { Library } from "./library";
import { excludesEntry } from "./scanRules";
import type {
  Entry,
  Metadata,
  ScanMode,
  ScanProgress,
  ScanReport,
  ScanRules,
  SourceStatus,
} from "./types";

// Discover the entire selected scope before importing anything. The second
// phase has one fixed denominator, including when it spans several sources.
export async function runScanJob(options: {
  library: Library;
  sources: SourceStatus[];
  mode: ScanMode;
  rules: ScanRules;
  signal: AbortSignal;
  enumerate: (
    source: SourceStatus,
    found: (count: number, path: string) => void,
  ) => Promise<Entry[]>;
  parse: (entry: Entry, source: SourceStatus) => Promise<Metadata>;
  progress: (value: ScanProgress) => void;
  sourceError: (source: SourceStatus, error: unknown) => void;
}): Promise<ScanReport> {
  const { library, sources, mode, rules, signal, progress } = options;
  const report: ScanReport = {
    mode,
    total: 0,
    added: 0,
    updated: 0,
    unchanged: 0,
    missing: 0,
    filtered: 0,
    errors: [],
    offlineSources: [],
    at: Date.now(),
  };
  const plans: {
    source: SourceStatus;
    index: number;
    entries: Entry[];
    count: number;
  }[] = [];
  let found = 0,
    processed = 0;
  const checkCancelled = () => {
    if (signal.aborted)
      throw new Error("扫描已取消；当前来源未提交，之前完成的来源保留更新");
  };
  const emit = (
    phase: ScanProgress["phase"],
    source: SourceStatus,
    index: number,
    done: number,
    total: number | null,
    path = "",
  ) =>
    progress({
      phase,
      source: source.name,
      sourceIndex: index + 1,
      sourceCount: sources.length,
      done,
      total,
      path,
    });
  for (const [index, source] of sources.entries()) {
    checkCancelled();
    emit("discovering", source, index, found, null);
    if (source.error) {
      report.offlineSources!.push(source.name);
      continue;
    }
    try {
      const entries = await options.enumerate(source, (count, path) =>
        emit("discovering", source, index, found + count, null, path),
      );
      checkCancelled();
      found += entries.length;
      const count = entries.filter(
        (entry) => !excludesEntry(entry, rules),
      ).length;
      report.total += count;
      plans.push({ source, index, entries, count });
    } catch (error) {
      checkCancelled();
      report.offlineSources!.push(source.name);
      options.sourceError(source, error);
    }
  }
  checkCancelled();
  for (const { source, index, entries, count } of plans) {
    emit("reading", source, index, processed, report.total);
    // Give the UI a frame to show the now-known total before reading tags.
    await new Promise((resolve) => setTimeout(resolve, 0));
    checkCancelled();
    try {
      const result = await library.scan(
        mode,
        async () => entries,
        (entry) => options.parse(entry, source),
        (done, total, path) =>
          emit(
            done === total ? "saving" : "reading",
            source,
            index,
            processed + done,
            report.total,
            path,
          ),
        signal,
        source.id,
        rules,
      );
      for (const key of ["added", "updated", "unchanged", "missing"] as const)
        report[key] += result[key];
      report.filtered! += result.filtered || 0;
      report.errors.push(...result.errors);
    } catch (error) {
      checkCancelled();
      report.offlineSources!.push(source.name);
      options.sourceError(source, error);
    }
    processed += count;
  }
  checkCancelled();
  return report;
}
