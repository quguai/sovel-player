import { parseFromTokenizer, selectCover } from "music-metadata";
import { RangeTokenizer, type RandomReader } from "./RangeTokenizer";
import { fallbackMetadata, type Metadata } from "./types";
import { parseLyrics } from "./lyrics";
export async function readMetadata(
  reader: RandomReader,
  path: string,
): Promise<{
  metadata: Metadata;
  picture?: { data: Uint8Array; format: string };
  artistPicture?: { data: Uint8Array; format: string };
}> {
  const tokenizer = new RangeTokenizer(reader, path);
  try {
    const parsed = await parseFromTokenizer(tokenizer, { duration: false });
    const { common, format } = parsed;
    const lyricsTag = common.lyrics?.[0];
    const text = lyricsTag?.text || "";
    const lyrics =
      lyricsTag?.syncText?.length && lyricsTag.timeStampFormat === 2
        ? lyricsTag.syncText
            .filter((l) => l.timestamp != null)
            .map((l) => ({ time: l.timestamp! / 1000, text: l.text }))
        : parseLyrics(text);
    // Performer portraits are separate from album artwork, even without a cover.
    const artistTypes = [
      "Lead artist/lead performer/soloist",
      "Artist/performer",
      "Band/Orchestra",
      "Band/artist logotype",
    ];
    const artistPicture = artistTypes
      .map((type) => common.picture?.find((image) => image.type === type))
      .find((image) => image?.data.length);
    const picture =
      selectCover(
        common.picture?.filter(
          (image) => !artistTypes.includes(image.type || ""),
        ),
      ) || undefined;
    return {
      metadata: {
        ...fallbackMetadata(path),
        title: common.title || fallbackMetadata(path).title,
        artist: common.artists?.join(" / ") || common.artist || "未知艺术家",
        album: common.album || "未命名专辑",
        albumArtist: common.albumartist,
        genres: [
          ...new Set(
            (common.genre || []).map((value) => value.trim()).filter(Boolean),
          ),
        ],
        track: common.track?.no ?? undefined,
        disc: common.disk?.no ?? undefined,
        duration: format.duration || 0,
        sampleRate: format.sampleRate,
        bits: format.bitsPerSample,
        channels: format.numberOfChannels,
        lyrics,
      },
      picture,
      artistPicture,
    };
  } finally {
    await tokenizer.close();
  }
}
