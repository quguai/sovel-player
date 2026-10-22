import React, { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  MediaServer,
  type ServerKind,
  type ServerSession,
  type ServerLibrary,
} from "../core/mediaServer";
import { isRemoteSource, type MusicSource } from "../core/types";
import { serverDeviceId } from "../services/remoteSources";
import { useMusic } from "../services/store";
import { Button } from "./components";
import { Icon, palette as p } from "./visuals";
export function MusicSourcesScreen() {
  const { height } = useWindowDimensions();
  const {
    sources,
    configureSource,
    moveSource,
    connectSource,
    syncSource,
    sourceBusy,
    remoteProgress,
    cancelRemote,
    addSources,
  } = useMusic();
  const [adding, setAdding] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [kind, setKind] = useState<ServerKind>("jellyfin");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<ServerSession | null>(null);
  const [libraries, setLibraries] = useState<ServerLibrary[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const busy = sourceBusy || working;
  const enabled = sources.filter((s) => s.enabled !== false);
  async function run(task: () => Promise<unknown>) {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作未完成，请重试");
    } finally {
      setWorking(false);
    }
  }
  function edit(source?: MusicSource) {
    setError("");
    setNotice("");
    setSession(null);
    setLibraries([]);
    setSelected([]);
    setPassword("");
    if (source?.config) {
      setKind(source.kind as ServerKind);
      setUrl(source.config.baseUrl);
    }
    setAdding(true);
  }
  async function login() {
    Keyboard.dismiss();
    const client = new MediaServer(url, kind, fetch, await serverDeviceId());
    const logged = await client.login(username, password);
    const choices = await client.libraries(logged);
    setPassword("");
    if (!choices.length)
      throw new Error(
        "此账号没有可用的音乐库，请检查服务器的音乐库类型及访问权限",
      );
    setUrl(client.baseUrl);
    setLibraries(choices);
    setSelected(choices.map((l) => l.id));
    setSession(logged);
  }
  async function connect() {
    Keyboard.dismiss();
    if (!session) return;
    await connectSource(
      kind,
      url,
      session,
      libraries.filter((l) => selected.includes(l.id)),
    );
    setSession(null);
    setAdding(false);
    setNotice("来源已连接，点击卡片中的“同步曲库”开始导入。");
  }
  return (
    <View style={{ gap: 22 }}>
      <LinearGradient colors={["#3a352b", "#242629"]} style={s.hero}>
        <View style={s.heroTop}>
          <Text style={s.eyebrow}>YOUR MUSIC, EVERYWHERE</Text>
          <View style={s.orbit}>
            <Icon name="library" size={22} color={p.gold} />
          </View>
        </View>
        <Text style={s.heading}>让曲库，汇聚于此。</Text>
        <Text style={s.description}>
          本地珍藏与远程音乐，在同一个地方聆听。
        </Text>
        <View style={s.totals}>
          <View>
            <Text style={s.number}>
              {enabled.length}
              <Text style={s.unit}> / {sources.length}</Text>
            </Text>
            <Text style={s.caption}>参与聚合的来源</Text>
          </View>
          <View style={s.divider} />
          <View>
            <Text style={s.number}>
              {sources
                .reduce((n, source) => n + (source.trackCount || 0), 0)
                .toLocaleString()}
            </Text>
            <Text style={s.caption}>已索引文件 · 重复版本保留</Text>
          </View>
        </View>
      </LinearGradient>
      <View style={s.sectionTop}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={s.section}>音乐来源</Text>
          <Text style={s.caption}>勾选参与聚合；同等条件按排列顺序播放</Text>
        </View>
        <Pressable
          accessibilityLabel="添加远程来源"
          disabled={busy}
          onPress={() => edit()}
          style={s.add}
        >
          <Text style={{ color: p.gold, fontSize: 13 }}>＋ 添加</Text>
        </Pressable>
      </View>
      <Modal
        visible={adding}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!working) {
            setAdding(false);
            setSession(null);
            setPassword("");
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#00000080",
          }}
        >
          <SafeAreaView
            edges={["bottom"]}
            style={{
              backgroundColor: "#25272a",
              flexShrink: 1,
              width: "100%",
              maxWidth: 560,
              alignSelf: "center",
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
            }}
          >
            <ScrollView
              key={session ? "library-picker" : "server-login"}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={{ maxHeight: height * 0.82 }}
              contentContainerStyle={[
                s.form,
                { backgroundColor: "transparent", paddingTop: 26 },
              ]}
            >
              <View style={s.sectionTop}>
                <Text style={s.section}>
                  {session ? "选择音乐库" : "连接音乐服务器"}
                </Text>
                <Pressable
                  disabled={working}
                  onPress={() => {
                    setAdding(false);
                    setSession(null);
                    setPassword("");
                  }}
                  accessibilityLabel="取消添加"
                  hitSlop={12}
                >
                  <Icon name="close" color={p.muted} size={20} />
                </Pressable>
              </View>
              {!session ? (
                <>
                  <View style={s.protocols}>
                    {(["jellyfin", "emby"] as const).map((value) => (
                      <Pressable
                        key={value}
                        disabled={working}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: kind === value }}
                        onPress={() => setKind(value)}
                        style={[
                          s.protocol,
                          kind === value && { backgroundColor: "#d5b7821b" },
                        ]}
                      >
                        <Text
                          style={{ color: kind === value ? p.gold : p.muted }}
                        >
                          {value === "jellyfin" ? "Jellyfin" : "Emby"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    editable={!working}
                    style={s.input}
                    value={url}
                    onChangeText={setUrl}
                    placeholder="https://music.example.com"
                    placeholderTextColor={p.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    accessibilityLabel="服务器地址"
                  />
                  <TextInput
                    editable={!working}
                    style={s.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="用户名"
                    placeholderTextColor={p.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    accessibilityLabel="服务器用户名"
                  />
                  <TextInput
                    editable={!working}
                    style={s.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="密码"
                    placeholderTextColor={p.muted}
                    secureTextEntry
                    autoComplete="current-password"
                    accessibilityLabel="服务器密码"
                  />
                  <Text style={s.caption}>
                    支持反向代理子路径及家庭局域网地址。登录信息保存在系统安全存储中。
                  </Text>
                  <Button
                    disabled={working || !url.trim() || !username.trim()}
                    onPress={() => void run(login)}
                  >
                    {working ? "正在连接…" : "连接并选择音乐库"}
                  </Button>
                </>
              ) : (
                <>
                  <Text style={s.caption}>
                    仅同步你勾选的音乐库，每个音乐库可独立排序。
                  </Text>
                  {libraries.map((library) => (
                    <Pressable
                      key={library.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked: selected.includes(library.id),
                      }}
                      onPress={() =>
                        setSelected((all) =>
                          all.includes(library.id)
                            ? all.filter((id) => id !== library.id)
                            : [...all, library.id],
                        )
                      }
                      style={s.library}
                    >
                      <Icon
                        name={
                          selected.includes(library.id) ? "check" : "folder"
                        }
                        color={selected.includes(library.id) ? p.gold : p.muted}
                        size={18}
                      />
                      <Text style={s.name}>{library.name}</Text>
                    </Pressable>
                  ))}
                  <Button
                    disabled={working || !selected.length}
                    onPress={() => void run(connect)}
                  >
                    {working ? "正在保存…" : `添加 ${selected.length} 个音乐库`}
                  </Button>
                </>
              )}
              {!!error && (
                <Text accessibilityLiveRegion="polite" style={s.error}>
                  {error}
                </Text>
              )}
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
      {sources.map((source, index) => {
        const remote = isRemoteSource(source);
        const active = source.enabled !== false;
        const progress =
          remoteProgress?.sourceId === source.id ? remoteProgress : null;
        const ratio = progress?.total
          ? Math.min(1, progress.done / progress.total)
          : 0;
        return (
          <View key={source.id} style={[s.source, !active && { opacity: 0.6 }]}>
            <View style={s.cardTop}>
              <View
                style={[
                  s.monogram,
                  {
                    backgroundColor:
                      source.kind === "jellyfin"
                        ? "#9e88da17"
                        : source.kind === "emby"
                          ? "#8bb88e17"
                          : "#d5b78216",
                  },
                ]}
              >
                {remote ? (
                  <Text
                    style={{
                      color: source.kind === "jellyfin" ? "#c2b0f0" : "#a7d6ad",
                      fontSize: 22,
                      fontWeight: "600",
                    }}
                  >
                    {source.kind === "jellyfin" ? "J" : "E"}
                  </Text>
                ) : (
                  <Icon name="folder" color={p.gold} size={23} />
                )}
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <Text numberOfLines={1} style={s.name}>
                  {source.name}
                </Text>
                <Text style={s.caption}>
                  {remote
                    ? source.kind === "jellyfin"
                      ? "Jellyfin"
                      : "Emby"
                    : "本地文件"}{" "}
                  · {source.trackCount || 0} 首
                </Text>
              </View>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active, disabled: busy }}
                accessibilityLabel={`${source.name} 参与聚合`}
                disabled={busy}
                onPress={() =>
                  void run(() =>
                    configureSource(source.id, { enabled: !active }),
                  )
                }
                style={[s.checkbox, active && s.checked]}
              >
                {active && <Icon name="check" size={15} color="#201d17" />}
              </Pressable>
            </View>
            {remote && (
              <Text numberOfLines={1} style={s.address}>
                {source.config?.baseUrl || "等待配置"}
              </Text>
            )}
            <View style={s.statusRow}>
              <View
                style={[
                  s.statusDot,
                  {
                    backgroundColor: source.error
                      ? "#d8987c"
                      : active
                        ? "#a5b899"
                        : p.muted,
                  },
                ]}
              />
              <Text numberOfLines={2} style={s.caption}>
                {source.error ||
                  (!active
                    ? "已退出聚合 · 索引仍然保留"
                    : remote
                      ? source.syncedAt
                        ? `上次同步 ${new Date(source.syncedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                        : "已连接 · 等待首次同步"
                      : "引用原文件 · 不复制音频")}
              </Text>
            </View>
            {progress && (
              <View style={{ gap: 9, marginTop: 14 }}>
                <View style={s.sectionTop}>
                  <Text style={s.caption}>
                    {progress.phase === "discovering"
                      ? "1 / 2 · 扫描服务器曲库"
                      : "2 / 2 · 导入音乐索引"}
                  </Text>
                  <Text style={{ color: p.gold, fontSize: 11 }}>
                    {progress.done} / {progress.total ?? "…"}
                  </Text>
                </View>
                <View style={s.track}>
                  <View style={[s.fill, { width: `${ratio * 100}%` }]} />
                </View>
              </View>
            )}
            <View style={s.cardFooter}>
              <Text style={[s.caption, { flex: 1 }]}>优先级 {index + 1}</Text>
              <Pressable
                disabled={busy || index === 0}
                accessibilityLabel={`${source.name} 提高优先级`}
                onPress={() => void run(() => moveSource(source.id, -1))}
                style={[s.order, (busy || index === 0) && { opacity: 0.25 }]}
              >
                <View style={{ transform: [{ rotate: "180deg" }] }}>
                  <Icon name="down" size={16} color={p.muted} />
                </View>
              </Pressable>
              <Pressable
                disabled={busy || index === sources.length - 1}
                accessibilityLabel={`${source.name} 降低优先级`}
                onPress={() => void run(() => moveSource(source.id, 1))}
                style={[
                  s.order,
                  (busy || index === sources.length - 1) && { opacity: 0.25 },
                ]}
              >
                <Icon name="down" size={16} color={p.muted} />
              </Pressable>
              {progress ? (
                <Pressable onPress={cancelRemote} style={s.sync}>
                  <Text style={{ color: p.gold, fontSize: 12 }}>取消</Text>
                </Pressable>
              ) : (
                <Pressable
                  disabled={busy || !active}
                  accessibilityLabel={`${source.name} 同步曲库`}
                  onPress={() =>
                    void run(async () => {
                      await syncSource(source.id);
                      setNotice(`${source.name} 同步完成`);
                    })
                  }
                  style={s.sync}
                >
                  <Text style={{ color: p.gold, fontSize: 12 }}>同步曲库</Text>
                </Pressable>
              )}
            </View>
            {remote && (
              <Pressable
                disabled={busy}
                onPress={() => edit(source)}
                style={{
                  alignSelf: "flex-start",
                  minHeight: 36,
                  justifyContent: "center",
                }}
              >
                <Text style={s.caption}>重新登录 / 选择音乐库</Text>
              </Pressable>
            )}
          </View>
        );
      })}
      {!sources.length && (
        <Text style={s.description}>
          添加一个文件夹或音乐服务器，开始建立你的曲库。
        </Text>
      )}
      {working && <ActivityIndicator color={p.gold} />}
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={s.error}>
          {error}
        </Text>
      )}
      {!!notice && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: p.gold, fontSize: 12, lineHeight: 20 }}
        >
          {notice}
        </Text>
      )}
      <Pressable
        disabled={busy}
        onPress={() => void run(() => addSources("folder"))}
        style={s.local}
      >
        <Icon name="folder" color={p.gold} size={20} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.name}>添加本地文件夹</Text>
          <Text style={s.caption}>保留原文件，在文件扫描中导入</Text>
        </View>
        <Icon name="forward" color={p.muted} size={17} />
      </Pressable>
      <View style={s.policy}>
        <Icon name="disc" size={19} color={p.gold} />
        <Text style={s.policyText}>
          一首歌曲，多个来源。默认无损优先，同等条件优先本地；手动选择版本后会记住。取消勾选不会删除音乐或收藏。
        </Text>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  hero: { padding: 23, borderRadius: 24, gap: 13 },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: { color: p.gold, fontSize: 9, letterSpacing: 1.6 },
  orbit: {
    width: 43,
    height: 43,
    borderRadius: 24,
    backgroundColor: "#d5b78213",
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    color: p.text,
    fontSize: 25,
    fontWeight: "600",
    letterSpacing: -0.6,
  },
  description: { color: p.muted, fontSize: 12, lineHeight: 21 },
  totals: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    marginTop: 13,
  },
  number: {
    color: p.text,
    fontSize: 27,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
    marginBottom: 6,
  },
  unit: { color: p.muted, fontSize: 14 },
  caption: { color: p.muted, fontSize: 11, lineHeight: 18, flexShrink: 1 },
  divider: { width: 1, height: 37, backgroundColor: "#d5b78222" },
  sectionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  section: { color: p.text, fontSize: 17, fontWeight: "600" },
  add: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "#d5b78213",
    borderRadius: 22,
  },
  source: {
    backgroundColor: "#ffffff05",
    borderRadius: 20,
    padding: 18,
    marginTop: -6,
  },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  monogram: {
    width: 47,
    height: 47,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  name: { color: p.text, fontSize: 14, fontWeight: "500" },
  checkbox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ffffff20",
    alignItems: "center",
    justifyContent: "center",
  },
  checked: { backgroundColor: p.gold, borderColor: p.gold },
  address: { color: "#a4a19b", fontSize: 11, marginTop: 15 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 13,
  },
  statusDot: { width: 5, height: 5, borderRadius: 4 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: p.line,
    marginTop: 15,
    paddingTop: 7,
  },
  order: {
    width: 40,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  sync: { minHeight: 44, paddingLeft: 12, justifyContent: "center" },
  track: {
    height: 3,
    backgroundColor: "#ffffff15",
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: { height: 3, backgroundColor: p.gold },
  form: {
    gap: 16,
    backgroundColor: "#ffffff07",
    borderRadius: 22,
    padding: 20,
  },
  protocols: {
    flexDirection: "row",
    backgroundColor: "#00000020",
    padding: 4,
    borderRadius: 13,
  },
  protocol: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  input: {
    color: p.text,
    fontSize: 14,
    minHeight: 48,
    backgroundColor: "#00000022",
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  library: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
  },
  error: { color: "#edaa95", fontSize: 12, lineHeight: 20 },
  local: {
    flexDirection: "row",
    alignItems: "center",
    padding: 17,
    borderRadius: 18,
    backgroundColor: "#d5b78209",
    gap: 13,
  },
  policy: {
    flexDirection: "row",
    gap: 11,
    paddingHorizontal: 3,
    paddingBottom: 14,
  },
  policyText: { color: p.muted, fontSize: 11, lineHeight: 20, flex: 1 },
});
