import test from "node:test";
import assert from "node:assert/strict";
import { ExternalSource, xml } from "../src/core/externalSources";
import { mergeDiscovery, parseDiscovery } from "../src/core/networkDiscovery";
import { readFile } from "node:fs/promises";
const response = (
  body: string,
  headers: Record<string, string> = {},
  status = 200,
) => new Response(body, { headers, status });
const config = {
  baseUrl: "http://nas/dav",
  serverId: "nas",
  userId: "u",
  libraryId: "http://nas/dav",
};
const signal = () => new AbortController().signal;
const multistatus = (rows: string) =>
  `<d:multistatus xmlns:d="DAV:">${rows}</d:multistatus>`;
const davRow = (href: string, directory: boolean, size = 0) =>
  `<d:response><d:href>${href}</d:href><d:propstat><d:prop><d:resourcetype>${directory ? "<d:collection/>" : ""}</d:resourcetype><d:getcontentlength>${size}</d:getcontentlength><d:getlastmodified>Wed, 21 Oct 2026 01:00:00 GMT</d:getlastmodified></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`;
test("LAN discovery deduplicates server IDs, preserves reverse-proxy prefixes and rejects credential URLs / malformed advertisements", () => {
  const packet = {
    kind: "jellyfin",
    address: "192.168.1.2",
    data: JSON.stringify({
      Id: "abc",
      Name: "NAS",
      Address: "http://192.168.1.2:8096/jellyfin",
    }),
  };
  assert.equal(mergeDiscovery([packet, packet]).length, 1);
  assert.equal(parseDiscovery(packet)?.url, "http://192.168.1.2:8096/jellyfin");
  assert.equal(parseDiscovery({ ...packet, data: "bad" }), null);
  assert.equal(
    parseDiscovery({
      ...packet,
      data: JSON.stringify({ Address: "http://user:pass@nas" }),
    }),
    null,
  );
  assert.equal(
    parseDiscovery({
      kind: "dlna",
      address: "nas",
      data: "HTTP/1.1 200 OK\r\nLOCATION: http://nas/desc.xml\r\nUSN: uuid:123\r\n\r\n",
    })?.kind,
    "dlna",
  );
});
test("XML rejects DTD/entity expansion and invalid documents", () => {
  assert.throws(() => xml('<!DOCTYPE x [<!ENTITY z "secret">]><x>&z;</x>'));
  assert.throws(() => xml("<broken>"));
});
test("WebDAV discovers before parsing tags, stays within selected folder, uses authenticated Range reads and preserves Unicode paths", async () => {
  const wav = await readFile(new URL("./fixtures/sample.wav", import.meta.url));
  let reads = 0;
  const request: typeof fetch = async (_input, options) => {
    assert.equal((options?.headers as any).Authorization, "Basic dTpw");
    if (options?.method === "PROPFIND")
      return response(
        multistatus(
          davRow("/dav/", true) +
            davRow("/dav/%E5%88%9D%E8%A7%81.wav", false, wav.length) +
            davRow("http://evil.test/steal.wav", false, wav.length),
        ),
      );
    throw new Error("Audio must use the injected native reader");
  };
  const client = new ExternalSource(config.baseUrl, "webdav", request, {
    httpRead: async (_url, headers, offset, length) => {
      assert.equal(headers.Authorization, "Basic dTpw");
      reads++;
      return wav.subarray(offset, offset + length);
    },
  });
  await client.login("u", "p");
  const page = await client.items(config, "", 0, signal());
  assert.equal(page.total, 1);
  assert.equal(reads, 0);
  assert.equal(page.items[0].path, "初见.wav");
  const parsed = await client.hydrate(page.items[0], signal());
  assert.equal(parsed.metadata.title, "初见");
  assert.ok(reads > 0);
  assert.ok(!client.stream(config, page.items[0].id).includes("Basic"));
});
test("WebDAV tag reads propagate native I/O failures instead of importing partial tags", async () => {
  const client = new ExternalSource("http://nas/dav", "webdav", fetch, {
    httpRead: async () => {
      throw new Error("Native range read failed");
    },
  });
  await assert.rejects(
    client.hydrate(
      {
        id: "http://nas/dav/a.wav",
        path: "a.wav",
        size: 100,
        mtime: 0,
        metadata: {
          title: "a",
          artist: "x",
          album: "x",
          duration: 0,
          format: "WAV",
          lyrics: [],
        },
      },
      signal(),
    ),
    /Native range read failed/,
  );
});
test("DLNA resolves ContentDirectory, handles escaped DIDL and pages by NumberReturned, streaming only advertised HTTP resources", async () => {
  const requests: string[] = [];
  const request: typeof fetch = async (_input, options) => {
    requests.push(String(_input));
    if (!options?.method)
      return response(
        "<root><device><friendlyName>客厅 NAS</friendlyName><serviceList><service><serviceType>urn:schemas-upnp-org:service:ContentDirectory:1</serviceType><controlURL>/ctl</controlURL></service></serviceList></device></root>",
      );
    assert.equal(
      (options.headers as any).SOAPAction,
      '"urn:schemas-upnp-org:service:ContentDirectory:1#Browse"',
    );
    const didl =
      '<DIDL-Lite><item id="song"><title>远方</title><artist>Sovel</artist><album>海岸</album><class>object.item.audioItem.musicTrack</class><res protocolInfo="http-get:*:audio/flac:*" duration="00:03:20" sampleFrequency="96000" bitsPerSample="24">http://nas/audio.flac</res></item></DIDL-Lite>';
    return response(
      `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:BrowseResponse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1"><Result>${didl.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Result><NumberReturned>1</NumberReturned><TotalMatches>1</TotalMatches></u:BrowseResponse></s:Body></s:Envelope>`,
    );
  };
  const client = new ExternalSource("http://nas/desc.xml", "dlna", request);
  await client.login("", "");
  const page = await client.items(
    { ...config, libraryId: "0" },
    "",
    0,
    signal(),
  );
  assert.equal(page.total, 1);
  assert.equal(page.items[0].metadata.duration, 200);
  assert.equal(page.items[0].metadata.bits, 24);
  assert.equal(
    client.playback(page.items[0].metadata.mediaSourceId!).uri,
    "http://nas/audio.flac",
  );
  assert.ok(requests.includes("http://nas/ctl"));
});
test("OpenSubsonic enumerates albums in folders, hashes password with salt and requests raw streams without storing credentials in the index URI", async () => {
  const urls: URL[] = [];
  const request: typeof fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    assert.ok(url.searchParams.get("t"));
    assert.ok(!url.toString().includes("private-password"));
    const path = url.pathname;
    const data = path.includes("getMusicFolders")
      ? { musicFolders: { musicFolder: [{ id: "music", name: "音乐" }] } }
      : path.includes("getAlbumList2")
        ? {
            albumList2: {
              album:
                url.searchParams.get("offset") === "0" ? [{ id: "a" }] : [],
            },
          }
        : path.includes("getAlbum.view")
          ? {
              album: {
                name: "海岸",
                song: [
                  {
                    id: "1",
                    title: "远方",
                    artist: "Sovel",
                    album: "海岸",
                    suffix: "flac",
                    duration: 200,
                    coverArt: "cover",
                  },
                ],
              },
            }
          : {};
    return Response.json({ "subsonic-response": { status: "ok", ...data } });
  };
  const client = new ExternalSource("http://nas/music", "subsonic", request, {
    nonce: "random-salt",
  });
  await client.login("u", "private-password");
  assert.equal((await client.libraries())[0].id, "music");
  const page = await client.items(
    { ...config, libraryId: "music" },
    "",
    0,
    signal(),
  );
  assert.equal(page.total, 1);
  assert.equal(page.items[0].metadata.format, "FLAC");
  assert.ok(!client.stream(config, "1").includes("t="));
  assert.ok(client.playback("1").uri.includes("format=raw"));
  assert.ok(client.artwork("subsonic-art:cover").includes("getCoverArt"));
});

test("SMB inventory applies scan rules before parsing tags and keeps paths relative to the share", async () => {
  const wav = await readFile(new URL("./fixtures/sample.wav", import.meta.url));
  let reads = 0;
  const transport = {
    connect: async () => "http://127.0.0.1:123/token/",
    list: async (_id: string, path: string) =>
      path === ""
        ? [
            { name: "初见.wav", directory: false, size: wav.length, mtime: 1 },
            { name: ".hidden", directory: true, size: 0, mtime: 1 },
            { name: "tiny.wav", directory: false, size: 1, mtime: 1 },
          ]
        : [],
    read: async (
      _id: string,
      _path: string,
      offset: number,
      length: number,
    ) => {
      reads++;
      return wav.subarray(offset, offset + length);
    },
  };
  const client = new ExternalSource("smb://nas/Music", "smb", fetch, {
    smb: transport,
    rules: {
      filterSmall: true,
      minSizeKB: 1,
      ignoreHidden: true,
      includeSubfolders: true,
    },
  });
  await client.login("user", "secret");
  const page = await client.items(
    { ...config, libraryId: "" },
    "",
    0,
    signal(),
  );
  assert.equal(page.total, 1);
  assert.equal(reads, 0);
  assert.equal(page.items[0].id, "初见.wav");
  const tagged = await client.hydrate(page.items[0], signal());
  assert.equal(tagged.metadata.title, "初见");
  assert.ok(reads > 0);
  assert.ok(!client.stream(config, tagged.id).includes("secret"));
  assert.ok(client.playback(tagged.id).uri.endsWith("%E5%88%9D%E8%A7%81.wav"));
});
