import { test } from "node:test";
import assert from "node:assert/strict";
import { trackDetails } from "../src/core/trackDetails";
import {
  fallbackMetadata,
  type Track,
  type SourceStatus,
} from "../src/core/types";
const track: Track = {
  ...fallbackMetadata("夜曲.flac"),
  id: "1",
  sourceId: "external",
  uri: "",
  path: "夜曲.flac",
  size: 1024 * 1024,
  mtime: 0,
  available: true,
  favorite: false,
};
const source: SourceStatus = {
  id: "external",
  name: "SD 卡",
  kind: "directory",
  uri: "content://source",
};
test("local file path is decoded without changing the playback URI", () => {
  const uri = "file:///Music/%E5%A4%9C%E6%9B%B2/01%20A%23B.flac";
  const { file } = trackDetails({ ...track, path: "01 A#B.flac" }, source, uri);
  assert.equal(new Map(file).get("文件路径"), "/Music/夜曲/01 A#B.flac");
  assert.deepEqual(
    file.map(([label]) => label),
    ["文件名", "文件路径", "修改时间"],
  );
});
test("SAF documents display the scanned path without claiming an absolute path", () => {
  const uri = "content://provider/document/1%2F2%3Afile";
  const file = new Map(
    trackDetails({ ...track, path: "古典/钢琴/夜曲.flac" }, source, uri).file,
  );
  assert.equal(file.get("文件路径"), "古典/钢琴/夜曲.flac（相对音乐目录）");
  const singleFile = new Map(
    trackDetails(track, { ...source, kind: "file" }, uri).file,
  );
  assert.equal(singleFile.get("文件路径"), "系统未提供文件路径");
});
test("missing metadata and modification dates remain unknown", () => {
  const info = trackDetails(track, { ...source, error: "请重新授权" });
  assert.equal(new Map(info.audio).get("位深"), "未知");
  assert.equal(new Map(info.file).get("修改时间"), "未知");
});
