import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useMusic } from "../services/store";
import { normalizeScanRules } from "../core/scanRules";
import { isRemoteSource, type ScanRules } from "../core/types";
import { Action, Button, navigationHeader } from "./components";
import { SettingGroup, SettingRow, SettingSwitch } from "./SettingsPanels";
import { palette as p } from "./visuals";
export function FileScanScreen({ onBack }: { onBack: () => void }) {
  const {
    sources: allSources,
    prefs,
    preferences,
    busy,
    scanProgress,
    report,
    addSources,
    importMusic,
    scan,
    cancel,
  } = useMusic();
  const sources = allSources.filter((source) => !isRemoteSource(source));
  const rules = prefs.scanRules;
  const [minSize, setMinSize] = useState(String(rules.minSizeKB));
  const [showSources, setShowSources] = useState(false);
  const [more, setMore] = useState(false);
  const change = (patch: Partial<ScanRules>) =>
    preferences({ scanRules: normalizeScanRules({ ...rules, ...patch }) });
  const phaseNames = {
    preparing: "准备扫描",
    discovering: "1 / 2 · 扫描音乐文件",
    reading: "2 / 2 · 导入曲库",
    saving: "2 / 2 · 保存索引",
    complete: "扫描完成",
    cancelled: "扫描已取消",
    failed: "扫描未完成",
  };
  const active =
    busy &&
    scanProgress &&
    !["complete", "cancelled", "failed"].includes(scanProgress.phase);
  const fraction = scanProgress?.total
    ? Math.min(1, scanProgress.done / scanProgress.total)
    : null;
  return (
    <View style={{ flex: 1 }}>
      <View style={navigationHeader}>
        <Action icon="back" label="返回设置" onPress={onBack} />
        <Text style={s.heading}>文件扫描</Text>
        <View style={{ width: 46 }} />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <Text style={s.intro}>把你的音乐，留在原来的位置。</Text>
        <Text style={s.note}>
          仅建立曲库索引，不额外复制音频。先扫描并统计全部文件，再按总数显示导入进度。
        </Text>
        <View style={[s.card, { marginVertical: 22 }]}>
          <Text style={s.title}>
            音乐来源{" "}
            <Text style={s.note}>
              · {sources.reduce((n, source) => n + (source.trackCount || 0), 0)}{" "}
              首已索引
            </Text>
          </Text>
          <View style={s.actions}>
            <Pressable
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="添加音乐文件夹"
              onPress={() => addSources("folder")}
              style={[s.sourceButton, busy && s.disabled]}
            >
              <Text style={s.gold}>添加文件夹</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="选择音乐文件"
              onPress={() => addSources("files")}
              style={[s.sourceButton, busy && s.disabled]}
            >
              <Text style={s.gold}>选择文件</Text>
            </Pressable>
          </View>
          <SettingRow
            title="已连接的来源"
            value={`${sources.length} 个${sources.some((s) => s.error) ? " · 有离线来源" : ""}`}
            onPress={() => setShowSources(!showSources)}
          />
          {showSources &&
            sources.map((source) => (
              <SettingRow
                key={source.id}
                title={source.name}
                note={
                  source.error
                    ? "暂时离线 · 保留原有曲库"
                    : `${source.trackCount || 0} 首 · ${source.kind === "managed" ? "应用内文件" : "引用原文件"}`
                }
              />
            ))}
        </View>
        <SettingGroup title="扫描规则">
          <SettingRow title="过滤小文件" note="跳过低于指定大小的音频">
            <SettingSwitch
              label="过滤小文件"
              value={rules.filterSmall}
              disabled={busy}
              onChange={(filterSmall) => change({ filterSmall })}
            />
          </SettingRow>
          {rules.filterSmall && (
            <View style={s.threshold}>
              <Text style={s.note}>小于</Text>
              <TextInput
                accessibilityLabel="最小文件大小 KB"
                keyboardType="number-pad"
                editable={!busy}
                value={minSize}
                maxLength={7}
                onChangeText={(value) => {
                  const digits = value.replace(/\D/g, "");
                  setMinSize(digits);
                  if (digits) change({ minSizeKB: Number(digits) });
                }}
                onBlur={() => {
                  const next = normalizeScanRules({
                    ...rules,
                    minSizeKB: Number(minSize) || rules.minSizeKB,
                  });
                  setMinSize(String(next.minSizeKB));
                  change(next);
                }}
                style={s.input}
              />
              <Text style={s.note}>KB 的文件</Text>
            </View>
          )}
          <SettingRow
            title="忽略隐藏文件与文件夹"
            note="跳过名称以点号开头的内容"
          >
            <SettingSwitch
              label="忽略隐藏文件与文件夹"
              value={rules.ignoreHidden}
              disabled={busy}
              onChange={(ignoreHidden) => change({ ignoreHidden })}
            />
          </SettingRow>
          <SettingRow title="包含子文件夹" note="一并扫描专辑等下级目录">
            <SettingSwitch
              label="包含子文件夹"
              value={rules.includeSubfolders}
              disabled={busy}
              onChange={(includeSubfolders) => change({ includeSubfolders })}
            />
          </SettingRow>
        </SettingGroup>
        <Text style={[s.note, { marginTop: -10, marginBottom: 20 }]}>
          规则只影响本次扫描范围，已入库但被过滤的歌曲会保留。
        </Text>
        <View style={s.actions}>
          {(
            [
              ["incremental", "增量扫描", "只读取新增或变化的音乐"],
              ["full", "全量扫描", "重新读取全部标签与封面"],
            ] as const
          ).map(([mode, title, note]) => (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityLabel={title}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => scan(mode)}
              style={[
                s.scanButton,
                mode === "incremental" && s.primary,
                busy && s.disabled,
              ]}
            >
              <Text
                style={[
                  s.title,
                  mode === "incremental" && { color: "#28221a" },
                ]}
              >
                {title}
              </Text>
              <Text
                style={[
                  s.note,
                  mode === "incremental" && { color: "#5b4d38" },
                  { marginTop: 9 },
                ]}
              >
                {note}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[s.note, { marginTop: 12 }]}>
          两种扫描都核对文件位置，并保留收藏。全量扫描不会清空数据库。
        </Text>
        {scanProgress && (
          <View style={[s.card, { marginTop: 22 }]}>
            <View style={s.status}>
              <Text accessibilityLiveRegion="polite" style={s.title}>
                {phaseNames[scanProgress.phase]}
              </Text>
              {active && <ActivityIndicator color={p.gold} />}
            </View>
            {active && (
              <>
                <Text style={[s.note, { marginTop: 10 }]}>
                  {scanProgress.sourceIndex} / {scanProgress.sourceCount} 个来源
                  · {scanProgress.source}
                </Text>
                <Text style={s.note}>
                  {scanProgress.total === null
                    ? `已发现 ${scanProgress.done} 个音频文件`
                    : `已处理 ${scanProgress.done} / ${scanProgress.total} 首音乐`}
                </Text>
                {fraction !== null && (
                  <View
                    accessibilityRole="progressbar"
                    accessibilityValue={{
                      min: 0,
                      max: 100,
                      now: Math.round(fraction * 100),
                    }}
                    style={s.progress}
                  >
                    <View style={[s.fill, { width: `${fraction * 100}%` }]} />
                  </View>
                )}
                <Text numberOfLines={1} style={[s.note, { marginBottom: 15 }]}>
                  {scanProgress.path}
                </Text>
                <Button secondary onPress={cancel}>
                  取消扫描
                </Button>
              </>
            )}
            {scanProgress.phase === "cancelled" && (
              <Text style={[s.note, { marginTop: 8 }]}>
                当前来源未提交，之前完成的来源保留更新。
              </Text>
            )}
          </View>
        )}
        {report && (
          <View style={[s.card, { marginTop: 16 }]}>
            <Text style={s.title}>
              {report.offlineSources?.length
                ? "最近扫描 · 部分来源跳过"
                : "最近扫描结果"}
            </Text>
            <Text style={[s.note, { marginTop: 6 }]}>
              {new Date(report.at).toLocaleString()}
            </Text>
            <View style={s.metrics}>
              {[
                ["新增", report.added],
                ["更新", report.updated],
                ["未变化", report.unchanged],
              ].map(([title, count]) => (
                <View key={title} style={{ flex: 1 }}>
                  <Text style={s.metric}>{count}</Text>
                  <Text style={s.note}>{title}</Text>
                </View>
              ))}
            </View>
            <Text style={s.note}>
              已发现文件中被过滤 {report.filtered || 0} · 缺失 {report.missing}{" "}
              · 读取失败 {report.errors.length}
            </Text>
            {!!report.offlineSources?.length && (
              <Text style={[s.note, { color: p.gold, marginTop: 8 }]}>
                暂时跳过：{report.offlineSources.join("、")}。原有索引已保留。
              </Text>
            )}
            {report.errors.slice(0, 3).map((error, index) => (
              <Text key={index} style={s.note}>
                {error.path}：{error.message}
              </Text>
            ))}
          </View>
        )}
        <SettingRow
          title="更多导入方式"
          note="应用内副本与远程曲库"
          onPress={() => setMore(!more)}
        />
        {more && (
          <View style={{ gap: 14, marginTop: 16 }}>
            <Button
              secondary
              disabled={busy}
              onPress={() => importMusic("copy")}
            >
              复制音乐到应用
            </Button>
            <Text style={s.note}>
              复制是可选项，会额外占用音频大小的空间。远程 SMB / WebDAV / DLNA /
              OpenSubsonic 曲库后续接入。
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  heading: { color: p.text, fontSize: 19, fontWeight: "600" },
  content: { padding: 24, paddingBottom: 50 },
  intro: { color: p.text, fontSize: 19, fontWeight: "500", marginBottom: 10 },
  note: { color: p.muted, fontSize: 12, lineHeight: 19 },
  title: { color: p.text, fontSize: 15, fontWeight: "600" },
  gold: { color: p.gold, fontSize: 13, fontWeight: "600" },
  card: { backgroundColor: "#ffffff05", padding: 17, borderRadius: 17 },
  actions: { flexDirection: "row", gap: 10 },
  sourceButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 10,
    backgroundColor: "#d5b7820d",
    alignItems: "center",
    marginTop: 16,
  },
  threshold: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  input: {
    minWidth: 85,
    minHeight: 44,
    backgroundColor: p.bg,
    color: p.text,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  scanButton: {
    flex: 1,
    padding: 18,
    borderRadius: 15,
    backgroundColor: p.surface,
  },
  primary: { backgroundColor: p.gold },
  disabled: { opacity: 0.4 },
  status: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progress: {
    height: 4,
    backgroundColor: p.surface,
    borderRadius: 2,
    overflow: "hidden",
    marginVertical: 14,
  },
  fill: { height: 4, backgroundColor: p.gold },
  metrics: { flexDirection: "row", marginVertical: 17 },
  metric: { color: p.gold, fontSize: 23, fontVariant: ["tabular-nums"] },
});
