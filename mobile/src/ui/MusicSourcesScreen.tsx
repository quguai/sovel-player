import { themeStyles } from "./themeStyles";
import { useEffect, useRef, useState } from "react";
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
import {
  MediaServer,
  type ServerSession,
  type ServerLibrary,
} from "../core/mediaServer";
import {
  isRemoteSource,
  type MusicSource,
  type RemoteKind,
} from "../core/types";
import { externalLogin, serverDeviceId } from "../services/remoteSources";
import { useMusic } from "../services/store";
import { Button } from "./components";
import { Icon, palette as p } from "./visuals";
import { remoteNames } from "../core/externalSources";
import { discoverServers, cancelDiscovery } from "../services/network";
import type { DiscoveredServer } from "../core/networkDiscovery";
const sourceType = (source: MusicSource) =>
  isRemoteSource(source) ? remoteNames[source.kind as RemoteKind] : "本地文件";

function SourceMark({ source }: { source: MusicSource }) {
  const remote = isRemoteSource(source);
  const color =
    source.kind === "jellyfin"
      ? "#c2b0f0"
      : source.kind === "emby"
        ? "#a7d6ad"
        : p.gold;
  return (
    <View style={[s.monogram, { backgroundColor: `${color}12` }]}>
      {remote ? (
        <Text style={[s.monogramLetter, { color }]}>
          {sourceType(source).slice(0, 1)}
        </Text>
      ) : (
        <Icon name="folder" color={color} size={20} />
      )}
    </View>
  );
}

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
  const [detailId, setDetailId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<DiscoveredServer[]>([]);
  const [searched, setSearched] = useState(false);
  const discoveryRevision = useRef(0);
  useEffect(
    () => () => {
      discoveryRevision.current++;
      cancelDiscovery();
    },
    [],
  );
  function stopDiscovery() {
    discoveryRevision.current++;
    cancelDiscovery();
    setSearching(false);
  }
  async function searchNetwork() {
    const revision = ++discoveryRevision.current;
    setSearching(true);
    setFound([]);
    setSearched(false);
    setError("");
    try {
      const servers = await discoverServers();
      if (revision === discoveryRevision.current) {
        setFound(servers);
        setSearched(true);
      }
    } catch {
      if (revision === discoveryRevision.current)
        setError("无法搜索局域网，请检查本地网络权限，或手动填写地址。");
    } finally {
      if (revision === discoveryRevision.current) setSearching(false);
    }
  }
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [kind, setKind] = useState<RemoteKind>("jellyfin");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<ServerSession | null>(null);
  const [libraries, setLibraries] = useState<ServerLibrary[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const busy = sourceBusy || working;
  const enabled = sources.filter((s) => s.enabled !== false);
  const detail = sources.find((source) => source.id === detailId);
  const detailIndex = sources.findIndex((source) => source.id === detailId);
  const detailProgress =
    remoteProgress?.sourceId === detailId ? remoteProgress : null;
  const detailActive = detail?.enabled !== false;
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
    setDetailId(null);
    setError("");
    setNotice("");
    setSession(null);
    setLibraries([]);
    setSelected([]);
    setPassword("");
    if (source?.config) {
      setKind(source.kind as RemoteKind);
      setUrl(source.config.baseUrl);
      setUsername(source.config.userId);
    } else {
      setUrl("");
      setUsername("");
      setFound([]);
      setSearched(false);
    }
    setAdding(true);
  }
  async function login() {
    Keyboard.dismiss();
    stopDiscovery();
    let logged: ServerSession,
      choices: ServerLibrary[],
      normalized = url;
    if (kind === "jellyfin" || kind === "emby") {
      const client = new MediaServer(url, kind, fetch, await serverDeviceId());
      logged = await client.login(username, password);
      choices = await client.libraries(logged);
      normalized = client.baseUrl;
    } else {
      const result = await externalLogin(url, kind, username, password);
      logged = result.session;
      choices = result.libraries;
      normalized = result.url;
    }
    setPassword("");
    if (!choices.length)
      throw new Error("未找到可读取的音乐库或目录，请检查地址和访问权限");
    setUrl(normalized);
    setLibraries(choices);
    setSelected(
      (kind === "jellyfin" || kind === "emby" || kind === "subsonic"
        ? choices
        : choices.slice(0, 1)
      ).map((l) => l.id),
    );
    setSession(logged);
  }
  function toggleLibrary(id: string) {
    setSelected((all) => {
      if (all.includes(id))
        return all.filter((selectedId) => selectedId !== id);
      if (kind === "dlna")
        return id === "0"
          ? [id]
          : [...all.filter((selectedId) => selectedId !== "0"), id];
      if (kind === "smb" || kind === "webdav") {
        const separate = all.filter(
          (selectedId) =>
            id &&
            selectedId &&
            !id.startsWith(selectedId + "/") &&
            !selectedId.startsWith(id + "/"),
        );
        return [...separate, id];
      }
      return [...all, id];
    });
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
    setNotice("来源已连接，点击来源卡片，在详情中同步曲库。");
  }
  return (
    <View style={{ gap: 14 }}>
      <View style={s.sectionTop}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={s.section}>我的曲库</Text>
          <Text style={s.caption}>
            {enabled.length} 个来源参与 ·{" "}
            {sources
              .reduce((n, source) => n + (source.trackCount || 0), 0)
              .toLocaleString()}{" "}
            首已索引
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="添加远程来源"
          disabled={busy}
          onPress={() => edit()}
          style={s.add}
        >
          <Text style={{ color: p.gold, fontSize: 13 }}>＋ 添加</Text>
        </Pressable>
      </View>
      <View style={s.grid}>
        {sources.map((source) => {
          const active = source.enabled !== false;
          const progress =
            remoteProgress?.sourceId === source.id ? remoteProgress : null;
          const state = progress
            ? `${progress.phase === "discovering" ? "扫描中" : "导入中"} · ${progress.done} 首`
            : !active
              ? "未参与聚合"
              : source.error
                ? "需要重新连接"
                : "已参与聚合";
          return (
            <Pressable
              key={source.id}
              accessibilityRole="button"
              accessibilityLabel={`查看 ${source.name} 详情`}
              accessibilityHint={`${sourceType(source)}，${source.trackCount || 0} 首，${state}`}
              onPress={() => {
                setError("");
                setNotice("");
                setDetailId(source.id);
              }}
              style={({ pressed }) => [
                s.source,
                !active && s.sourceInactive,
                pressed && { opacity: 0.65 },
              ]}
            >
              <View style={s.cardTop}>
                <SourceMark source={source} />
                <Icon name="forward" size={14} color={p.muted} />
              </View>
              <Text numberOfLines={2} style={s.cardName}>
                {source.name}
              </Text>
              <Text numberOfLines={1} style={s.caption}>
                {sourceType(source)} · {source.trackCount || 0} 首
              </Text>
              <View style={s.cardStatus}>
                {progress ? (
                  <ActivityIndicator size="small" color={p.gold} />
                ) : (
                  <View
                    style={[
                      s.statusDot,
                      {
                        backgroundColor: !active
                          ? p.muted
                          : source.error
                            ? "#d8987c"
                            : p.gold,
                      },
                    ]}
                  />
                )}
                <Text numberOfLines={1} style={s.cardState}>
                  {state}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Modal
        visible={adding || !!detail}
        transparent
        animationType="slide"
        supportedOrientations={["portrait", "landscape"]}
        onRequestClose={() => {
          if (!adding) setDetailId(null);
          else if (!working) {
            stopDiscovery();
            setAdding(false);
            setSession(null);
            setPassword("");
          }
        }}
      >
        {adding ? (
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
                      stopDiscovery();
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
                      {(Object.keys(remoteNames) as RemoteKind[]).map(
                        (value) => (
                          <Pressable
                            key={value}
                            disabled={working}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: kind === value }}
                            onPress={() => {
                              setKind(value);
                              setUrl("");
                              setUsername("");
                              setPassword("");
                              setError("");
                            }}
                            style={[
                              s.protocol,
                              kind === value && {
                                backgroundColor: `${p.gold}1b`,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: kind === value ? p.gold : p.muted,
                              }}
                            >
                              {remoteNames[value]}
                            </Text>
                          </Pressable>
                        ),
                      )}
                    </View>
                    <View style={s.discoveryHead}>
                      <Text style={s.caption}>
                        附近的 Emby / Jellyfin / DLNA
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="搜索局域网服务器"
                        disabled={working || searching}
                        onPress={() => void searchNetwork()}
                        style={s.discoveryAction}
                      >
                        {searching ? (
                          <ActivityIndicator size="small" color={p.gold} />
                        ) : (
                          <Text style={{ color: p.gold, fontSize: 12 }}>
                            搜索局域网
                          </Text>
                        )}
                      </Pressable>
                    </View>
                    {found.length > 0 && (
                      <View style={s.discoveryList}>
                        {found.map((server) => (
                          <Pressable
                            key={server.id}
                            accessibilityRole="button"
                            accessibilityLabel={`选择 ${server.name}`}
                            onPress={() => {
                              stopDiscovery();
                              setKind(server.kind);
                              setUrl(server.url);
                              setUsername("");
                              setPassword("");
                              setError("");
                            }}
                            style={s.discoveryRow}
                          >
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text numberOfLines={1} style={s.name}>
                                {server.name}
                              </Text>
                              <Text numberOfLines={1} style={s.caption}>
                                {remoteNames[server.kind]} · {server.url}
                              </Text>
                            </View>
                            <Icon name="forward" size={15} color={p.muted} />
                          </Pressable>
                        ))}
                      </View>
                    )}
                    {searched && !found.length && (
                      <Text style={s.caption}>
                        未发现服务器，仍可手动填写地址。请确认在同一局域网。
                      </Text>
                    )}
                    <TextInput
                      editable={!working}
                      style={s.input}
                      value={url}
                      onChangeText={setUrl}
                      placeholder={
                        kind === "smb"
                          ? "smb://192.168.1.10/Music"
                          : kind === "dlna"
                            ? "http://服务器/description.xml"
                            : "https://music.example.com"
                      }
                      placeholderTextColor={p.muted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      accessibilityLabel="服务器地址"
                    />
                    {kind !== "dlna" && (
                      <>
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
                      </>
                    )}
                    <Text style={s.caption}>
                      支持手动输入地址。登录信息仅保存在系统安全存储中；DLNA
                      无需账号。
                    </Text>
                    <Button
                      disabled={
                        working ||
                        !url.trim() ||
                        ((kind === "jellyfin" ||
                          kind === "emby" ||
                          kind === "subsonic") &&
                          !username.trim())
                      }
                      onPress={() => void run(login)}
                    >
                      {working
                        ? "正在连接…"
                        : kind === "dlna"
                          ? "读取音乐目录"
                          : "连接并选择音乐库"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Text style={s.caption}>
                      勾选需要同步的音乐库或目录，每个来源可独立排序。
                    </Text>
                    {libraries.map((library) => (
                      <Pressable
                        key={library.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{
                          checked: selected.includes(library.id),
                        }}
                        onPress={() => toggleLibrary(library.id)}
                        style={s.library}
                      >
                        <Icon
                          name={
                            selected.includes(library.id) ? "check" : "folder"
                          }
                          color={
                            selected.includes(library.id) ? p.gold : p.muted
                          }
                          size={18}
                        />
                        <Text style={s.name}>{library.name}</Text>
                      </Pressable>
                    ))}
                    <Button
                      disabled={working || !selected.length}
                      onPress={() => void run(connect)}
                    >
                      {working
                        ? "正在保存…"
                        : `添加 ${selected.length} 个音乐库`}
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
        ) : (
          <View style={s.overlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setDetailId(null)}
              accessibilityLabel="收起来源详情"
            />
            <SafeAreaView edges={["bottom"]} style={s.sheet}>
              <View style={s.handle} />
              <View style={s.detailHeading}>
                <Text style={s.section}>来源详情</Text>
                <Pressable
                  onPress={() => setDetailId(null)}
                  accessibilityRole="button"
                  accessibilityLabel="关闭来源详情"
                  style={s.order}
                >
                  <Icon name="close" color={p.muted} size={20} />
                </Pressable>
              </View>
              <ScrollView
                style={{ maxHeight: height * 0.72 }}
                contentContainerStyle={s.detailContent}
              >
                {detail && (
                  <>
                    <View style={s.identity}>
                      <SourceMark source={detail} />
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={s.detailName}>{detail.name}</Text>
                        <Text style={s.caption}>
                          {sourceType(detail)} · {detail.trackCount || 0}{" "}
                          首已索引
                        </Text>
                      </View>
                    </View>
                    <View style={s.detailGroup}>
                      <View style={s.detailRow}>
                        <View style={{ flex: 1, gap: 5 }}>
                          <Text style={s.name}>参与聚合</Text>
                          <Text style={s.caption}>关闭后保留索引与收藏</Text>
                        </View>
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityState={{
                            checked: detailActive,
                            disabled: busy,
                          }}
                          accessibilityLabel={`${detail.name} 参与聚合`}
                          disabled={busy}
                          onPress={() =>
                            void run(() =>
                              configureSource(detail.id, {
                                enabled: !detailActive,
                              }),
                            )
                          }
                          style={[s.checkbox, detailActive && s.checked]}
                        >
                          {detailActive && (
                            <Icon name="check" size={16} color="#201d17" />
                          )}
                        </Pressable>
                      </View>
                      <View style={[s.detailRow, s.rowDivider]}>
                        <View style={{ flex: 1, gap: 5 }}>
                          <Text style={s.name}>播放优先级</Text>
                          <Text style={s.caption}>
                            第 {detailIndex + 1} 位 · 同等条件下优先
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${detail.name} 提高优先级`}
                          disabled={busy || detailIndex === 0}
                          onPress={() =>
                            void run(() => moveSource(detail.id, -1))
                          }
                          style={[
                            s.order,
                            (busy || detailIndex === 0) && { opacity: 0.25 },
                          ]}
                        >
                          <View style={{ transform: [{ rotate: "180deg" }] }}>
                            <Icon name="down" size={18} color={p.gold} />
                          </View>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${detail.name} 降低优先级`}
                          disabled={busy || detailIndex === sources.length - 1}
                          onPress={() =>
                            void run(() => moveSource(detail.id, 1))
                          }
                          style={[
                            s.order,
                            (busy || detailIndex === sources.length - 1) && {
                              opacity: 0.25,
                            },
                          ]}
                        >
                          <Icon name="down" size={18} color={p.gold} />
                        </Pressable>
                      </View>
                    </View>
                    <View style={s.detailInfo}>
                      <Text style={s.caption}>
                        {isRemoteSource(detail) ? "服务器地址" : "文件位置"}
                      </Text>
                      <Text selectable style={s.detailValue}>
                        {detail.config?.baseUrl ||
                          (detail.kind === "managed"
                            ? "应用内 Music 目录"
                            : detail.uri)}
                      </Text>
                      <Text style={[s.caption, { marginTop: 12 }]}>
                        上次同步
                      </Text>
                      <Text style={s.detailValue}>
                        {detail.syncedAt
                          ? new Date(detail.syncedAt).toLocaleString("zh-CN")
                          : isRemoteSource(detail)
                            ? "等待首次同步"
                            : "在文件扫描中管理本地导入"}
                      </Text>
                      {!!detail.error && (
                        <Text style={s.error}>{detail.error}</Text>
                      )}
                    </View>
                    {detailProgress && (
                      <View style={s.progress}>
                        <View style={s.sectionTop}>
                          <Text style={s.caption}>
                            {detailProgress.phase === "discovering"
                              ? "1 / 2 · 扫描服务器曲库"
                              : "2 / 2 · 导入音乐索引"}
                          </Text>
                          <Text style={s.progressCount}>
                            {detailProgress.done} /{" "}
                            {detailProgress.total ?? "…"}
                          </Text>
                        </View>
                        <View style={s.track}>
                          <View
                            style={[
                              s.fill,
                              {
                                width: `${detailProgress.total ? Math.min(1, detailProgress.done / detailProgress.total) * 100 : 0}%`,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    )}
                    {!!error && (
                      <Text accessibilityLiveRegion="polite" style={s.error}>
                        {error}
                      </Text>
                    )}
                    {!!notice && (
                      <Text accessibilityLiveRegion="polite" style={s.notice}>
                        {notice}
                      </Text>
                    )}
                    {detailProgress ? (
                      <Button secondary onPress={cancelRemote}>
                        取消同步
                      </Button>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${detail.name} 同步曲库`}
                        disabled={busy || !detailActive}
                        onPress={() =>
                          void run(async () => {
                            await syncSource(detail.id);
                            setNotice(`${detail.name} 同步完成`);
                          })
                        }
                        style={({ pressed }) => [
                          s.sync,
                          (busy || !detailActive || pressed) && {
                            opacity: 0.5,
                          },
                        ]}
                      >
                        <Text style={s.syncText}>
                          {isRemoteSource(detail) ? "同步曲库" : "扫描此来源"}
                        </Text>
                      </Pressable>
                    )}
                    {working && !detailProgress && (
                      <ActivityIndicator color={p.gold} />
                    )}
                    {isRemoteSource(detail) && (
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => edit(detail)}
                        style={s.reconnect}
                      >
                        <Text style={s.caption}>重新登录 / 选择音乐库</Text>
                      </Pressable>
                    )}
                  </>
                )}
              </ScrollView>
            </SafeAreaView>
          </View>
        )}
      </Modal>
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
          点击卡片管理来源。关闭来源不会删除音乐或收藏。
        </Text>
      </View>
    </View>
  );
}
const s = themeStyles(() => ({
  discoveryHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  discoveryAction: {
    minHeight: 44,
    minWidth: 88,
    justifyContent: "center",
    alignItems: "center",
  },
  discoveryList: {
    backgroundColor: "#ffffff05",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  discoveryRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: p.line,
  },
  description: { color: p.muted, fontSize: 12, lineHeight: 21 },
  caption: { color: p.muted, fontSize: 11, lineHeight: 18, flexShrink: 1 },
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
    paddingHorizontal: 15,
    backgroundColor: `${p.gold}13`,
    borderRadius: 22,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  source: {
    width: "48%",
    padding: 14,
    minHeight: 152,
    borderRadius: 16,
    backgroundColor: "#ffffff06",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${p.gold}18`,
  },
  sourceInactive: {
    backgroundColor: "#ffffff02",
    borderColor: "#ffffff0b",
    opacity: 0.65,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  monogram: {
    width: 34,
    height: 34,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  monogramLetter: { fontSize: 20, fontWeight: "600" },
  cardName: {
    color: p.text,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
    minHeight: 36,
    marginBottom: 4,
  },
  name: { color: p.text, fontSize: 14, fontWeight: "500" },
  cardStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  cardState: { color: p.muted, fontSize: 10, flexShrink: 1 },
  statusDot: { width: 4, height: 4, borderRadius: 3 },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#00000080",
  },
  sheet: {
    backgroundColor: "#25272a",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  handle: {
    width: 34,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#ffffff25",
    alignSelf: "center",
    marginTop: 12,
  },
  detailHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 16,
    paddingRight: 14,
    paddingVertical: 4,
  },
  detailContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 4,
  },
  detailName: {
    color: p.text,
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 29,
  },
  detailGroup: {
    backgroundColor: "#ffffff05",
    borderRadius: 18,
    paddingHorizontal: 14,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 8,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: p.line,
  },
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
  order: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  detailInfo: { gap: 6, paddingHorizontal: 2 },
  detailValue: { color: p.text, fontSize: 12, lineHeight: 20 },
  progress: { gap: 10 },
  progressCount: { color: p.gold, fontSize: 11, fontVariant: ["tabular-nums"] },
  track: {
    height: 3,
    backgroundColor: "#ffffff15",
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: { height: 3, backgroundColor: p.gold },
  sync: {
    minHeight: 48,
    padding: 13,
    backgroundColor: p.gold,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  syncText: { color: "#27241e", fontSize: 14, fontWeight: "600" },
  reconnect: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -10,
  },
  notice: { color: p.gold, fontSize: 12, lineHeight: 20 },
  form: {
    gap: 12,
    backgroundColor: "#ffffff07",
    borderRadius: 22,
    padding: 16,
  },
  protocols: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#00000020",
    padding: 4,
    borderRadius: 13,
  },
  protocol: {
    flex: 1,
    minWidth: "30%",
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
    padding: 14,
    borderRadius: 18,
    backgroundColor: `${p.gold}09`,
    gap: 13,
  },
  policy: {
    flexDirection: "row",
    gap: 11,
    paddingHorizontal: 3,
    paddingBottom: 4,
  },
  policyText: { color: p.muted, fontSize: 11, lineHeight: 20, flex: 1 },
}));
