import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MusicProvider, useMusic } from "./src/services/store";
import { UpdatesProvider, useUpdates } from "./src/services/appUpdates";
import { artUri } from "./src/services/files";
import { Action } from "./src/ui/components";
import { Cover, palette as p } from "./src/ui/visuals";
import {
  LibraryScreen,
  SettingsScreen,
  SourcesScreen,
  DetailsScreen,
  s,
} from "./src/ui/screens";
import { PlayerDeck, type PlayerPanel } from "./src/ui/PlayerDeck";
import { PlayerBackdrop } from "./src/ui/PlayerBackdrop";
import { DismissiblePlayer } from "./src/ui/DismissiblePlayer";
import { StartupScreen } from "./src/ui/StartupScreen";
type Page = "library" | "player" | "settings" | "sources" | "details";
function Shell() {
  const [page, setPage] = useState<Page>("library"),
    [queue, setQueue] = useState(false);
  const [playerPanel, setPlayerPanel] = useState<PlayerPanel>("player");
  const {
    ready,
    startupStage,
    startupError,
    retryStartup,
    current,
    tracks,
    queue: playingQueue,
    play,
    busy,
    progress,
    error,
    setError,
    prefs,
  } = useMusic();
  const updates = useUpdates();
  const updateDownloading = updates.download.phase === "downloading";
  const updateVerifying = updates.download.phase === "verifying";
  const updateReady = updates.download.phase === "ready";
  const updatePercent =
    updates.download.total > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              (updates.download.received / updates.download.total) * 100,
            ),
          ),
        )
      : 0;
  const updateStatus = updates.installing
    ? "正在准备安装…"
    : updateDownloading
      ? `正在下载更新 · ${updatePercent}%`
      : updateVerifying
        ? "正在校验更新…"
        : updateReady
          ? "更新已就绪"
          : "发现新版本";
  const [updateEntry, setUpdateEntry] = useState(false);
  const playerPage = page === "player";
  const uri = artUri(current?.artwork);
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (queue) {
        setQueue(false);
        return true;
      }
      if (page === "player" && playerPanel !== "player") {
        setPlayerPanel("player");
        return true;
      }
      if (page !== "library") {
        setPage(
          page === "details"
            ? "player"
            : page === "sources"
              ? "settings"
              : "library",
        );
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [page, queue, playerPanel]);
  const notices = (
    <>
      {updates.release &&
        updates.release.tag !== updates.prefs.ignoredTag &&
        page !== "settings" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={updateReady ? "查看安装更新" : updateStatus}
            disabled={
              updateDownloading || updateVerifying || updates.installing
            }
            onPress={() => {
              setUpdateEntry(true);
              setPage("settings");
            }}
            style={styles.banner}
          >
            <View style={{ flex: 1, gap: 7 }}>
              <Text style={{ color: p.gold, fontSize: 12 }}>
                {updateStatus}
              </Text>
              {(updateDownloading || updateVerifying) && (
                <View
                  accessibilityRole="progressbar"
                  accessibilityLabel="更新下载进度"
                  accessibilityValue={{
                    min: 0,
                    max: 100,
                    now: updatePercent,
                  }}
                  style={styles.updateTrack}
                >
                  <View
                    style={[styles.updateFill, { width: `${updatePercent}%` }]}
                  />
                </View>
              )}
            </View>
            {!updateDownloading && !updateVerifying && (
              <Text style={{ color: p.gold, fontSize: 12 }}>
                {updateReady ? "安装更新 ›" : "更新 ›"}
              </Text>
            )}
          </Pressable>
        )}
      {busy && page !== "sources" && (
        <View style={styles.banner}>
          <ActivityIndicator color={p.gold} size="small" />
          <Text numberOfLines={2} style={[s.tiny, { flex: 1, color: p.text }]}>
            {progress}
          </Text>
        </View>
      )}
      {!!error && (
        <View style={[styles.banner, { backgroundColor: "#4a3430" }]}>
          <Text style={{ color: "#f0d3c6", fontSize: 12, flex: 1 }}>
            {error}
          </Text>
          <Action
            icon="close"
            label="关闭提示"
            onPress={() => setError("")}
            size={18}
          />
        </View>
      )}
    </>
  );
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style="light" />
      <SafeAreaView
        style={{ flex: 1 }}
        edges={["top", "bottom", "left", "right"]}
      >
        {!ready ? (
          <StartupScreen
            stage={startupStage}
            error={startupError}
            onRetry={retryStartup}
          />
        ) : (
          <View style={{ flex: 1 }}>
            <View
              style={{
                flex: 1,
                display: page === "library" || playerPage ? "flex" : "none",
              }}
              pointerEvents={playerPage ? "none" : "auto"}
              accessibilityElementsHidden={page !== "library"}
              importantForAccessibility={
                page === "library" ? "auto" : "no-hide-descendants"
              }
            >
              <LibraryScreen
                active={page === "library"}
                onPlayer={() => {
                  setPlayerPanel("player");
                  setPage("player");
                }}
                onSettings={() => {
                  setUpdateEntry(false);
                  setPage("settings");
                }}
                onQueue={() => setQueue(true)}
              />
            </View>
            {page === "library" || playerPage ? null : page === "settings" ? (
              <SettingsScreen
                initialSection={updateEntry ? "updates" : "root"}
                onBack={() => setPage("library")}
                onSources={() => setPage("sources")}
              />
            ) : page === "details" ? (
              <DetailsScreen onBack={() => setPage("player")} />
            ) : (
              <SourcesScreen onBack={() => setPage("settings")} />
            )}
          </View>
        )}
        {!playerPage && notices}
      </SafeAreaView>
      {playerPage && (
        <DismissiblePlayer onClose={() => setPage("library")}>
          {(dismiss, panHandlers) => (
            <>
              <PlayerBackdrop
                uri={uri}
                immersive={
                  prefs.player === "immersive" && playerPanel === "player"
                }
                active={playerPanel === "player" && !queue}
              />
              <SafeAreaView
                style={{ flex: 1 }}
                edges={["top", "bottom", "left", "right"]}
              >
                <PlayerDeck
                  panel={playerPanel}
                  onPanel={setPlayerPanel}
                  onDetails={() => setPage("details")}
                  onClose={dismiss}
                  onQueue={() => setQueue(true)}
                  dismissPanHandlers={panHandlers}
                />
                {notices}
              </SafeAreaView>
            </>
          )}
        </DismissiblePlayer>
      )}
      <Modal
        visible={queue}
        transparent
        animationType="slide"
        onRequestClose={() => setQueue(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#0007",
          }}
        >
          <Pressable
            accessibilityLabel="关闭播放队列"
            style={{ flex: 1 }}
            onPress={() => setQueue(false)}
          />
          <View style={styles.sheet}>
            <View style={[s.row, { marginBottom: 8 }]}>
              <View>
                <Text style={s.screenTitle}>接下来播放</Text>
                <Text style={s.tiny}>
                  {(playingQueue.length ? playingQueue : tracks).length} 首音乐
                </Text>
              </View>
              <Action
                icon="close"
                label="关闭播放队列"
                onPress={() => setQueue(false)}
              />
            </View>
            {queue && (
              <FlatList
                data={playingQueue.length ? playingQueue : tracks}
                keyExtractor={(track) => track.id}
                initialNumToRender={10}
                maxToRenderPerBatch={8}
                windowSize={5}
                renderItem={({ item: track }) => (
                  <Pressable
                    key={track.id}
                    style={s.trackRow}
                    onPress={() => {
                      play(track, playingQueue.length ? playingQueue : tracks);
                      setQueue(false);
                      setPage("player");
                    }}
                  >
                    <Cover track={track} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          s.trackTitle,
                          track.id === current?.id && { color: p.gold },
                        ]}
                      >
                        {track.title}
                      </Text>
                      <Text style={s.tiny}>{track.artist}</Text>
                    </View>
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <MusicProvider>
        <UpdatesProvider>
          <Shell />
        </UpdatesProvider>
      </MusicProvider>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  updateTrack: {
    height: 3,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "#ffffff16",
  },
  updateFill: { height: 3, backgroundColor: p.gold },
  banner: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 12,
    backgroundColor: "#31302c",
    flexDirection: "row",
    alignItems: "center",
  },
  sheet: {
    maxHeight: "65%",
    minHeight: 230,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    backgroundColor: p.bg,
    padding: 24,
    paddingBottom: 45,
  },
});
