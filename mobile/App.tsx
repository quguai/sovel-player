import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
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
type Page = "library" | "player" | "settings" | "sources" | "details";
function Shell() {
  const [page, setPage] = useState<Page>("library"),
    [queue, setQueue] = useState(false);
  const [playerPanel, setPlayerPanel] = useState<PlayerPanel>("player");
  const {
    ready,
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
  return (
    <View style={{ flex: 1, backgroundColor: playerPage ? "#746b66" : p.bg }}>
      <StatusBar style="light" />
      {playerPage && (
        <>
          <Image
            source={uri ? { uri } : require("./assets/artwork/ocean.jpg")}
            blurRadius={
              prefs.player === "immersive" && playerPanel === "player" ? 0 : 65
            }
            style={[
              StyleSheet.absoluteFill,
              {
                opacity:
                  prefs.player === "immersive" && playerPanel === "player"
                    ? 0.75
                    : 0.4,
              },
            ]}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["#48444835", "#39313570", "#292b36c9"]}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}
      <SafeAreaView
        style={{ flex: 1 }}
        edges={["top", "bottom", "left", "right"]}
      >
        {!ready && !error ? (
          <View style={s.center}>
            <ActivityIndicator color={p.gold} />
            <Text style={s.subtitle}>正在打开音乐库…</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {page === "library" ? (
              <LibraryScreen
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
            ) : page === "player" ? (
              <PlayerDeck
                panel={playerPanel}
                onPanel={setPlayerPanel}
                onDetails={() => setPage("details")}
                onClose={() => setPage("library")}
                onQueue={() => setQueue(true)}
              />
            ) : page === "settings" ? (
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
        {updates.release &&
          updates.release.tag !== updates.prefs.ignoredTag &&
          page !== "settings" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="查看新版本"
              onPress={() => {
                setUpdateEntry(true);
                setPage("settings");
              }}
              style={styles.banner}
            >
              <Text style={{ color: p.gold, flex: 1, fontSize: 12 }}>
                Sovel {updates.release.tag} 已发布
              </Text>
              <Text style={{ color: p.gold, fontSize: 12 }}>查看更新 ›</Text>
            </Pressable>
          )}
        {busy && page !== "sources" && (
          <View style={styles.banner}>
            <ActivityIndicator color={p.gold} size="small" />
            <Text
              numberOfLines={2}
              style={[s.tiny, { flex: 1, color: p.text }]}
            >
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
      </SafeAreaView>
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
            <ScrollView>
              {(playingQueue.length ? playingQueue : tracks).map((track) => (
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
              ))}
            </ScrollView>
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
