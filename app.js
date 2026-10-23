const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = {
  grid: '<path d="M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z"/>',
  list: '<path d="M3 5h3v3H3Zm7 1h11M3 11h3v3H3Zm7 1h11M3 17h3v3H3Zm7 1h11"/>',
  play: '<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>',
  previous: '<path d="M6 5v14m12-14L8 12l10 7Z" fill="currentColor"/>',
  next: '<path d="M18 5v14M6 5l10 7-10 7Z" fill="currentColor"/>',
  back: '<path d="m14 6-6 6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  forward: '<path d="m9 6 6 6-6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--surface)"/><circle cx="16" cy="17" r="3" fill="var(--surface)"/>',
  heart: '<path d="M20.2 5.8a5 5 0 0 0-7.1 0L12 6.9l-1.1-1.1a5 5 0 0 0-7.1 7.1L12 21l8.2-8.1a5 5 0 0 0 0-7.1Z"/>',
  library: '<path d="M4 4v16M9 4v16M14 5l5-1 3 15-5 1Z"/>',
  disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 12a5.5 5.5 0 0 1 5.5-5.5M17.5 12a5.5 5.5 0 0 1-5.5 5.5"/>',
  folder: '<path d="M3 7V5h6l2 2h10v13H3Z"/>',
  queue: '<path d="M4 5h16M4 11h16M4 17h10m4-2v6m-3-3h6"/>',
  repeat: '<path d="m17 2 4 4-4 4M3 10V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14 0v2a2 2 0 0 1-2 2H3"/>',
  'repeat-one': '<path d="m17 2 4 4-4 4M3 10V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14 0v2a2 2 0 0 1-2 2H3M10 11l2-1v5"/>',
  shuffle: '<path d="M3 5h3l12 14h3M3 19h3L18 5h3m-4-3 4 3-4 3m0 8 4 3-4 3"/>',
  lyrics: '<path d="M4 4h16v13H9l-5 4Zm4 5h8m-8 4h5"/>',
  headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2M4 13h3v7H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Zm16 0h-3v7h3a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2Z"/>',
  usb: '<path d="M12 21V3m-3 3 3-3 3 3m-3 9 6-4V7m-6 11-6-4v-4"/><circle cx="6" cy="9" r="1.5"/><path d="M16 4h4v4h-4Z"/>',
  shirt: '<path d="M8.2 3.3C9.1 2.9 9.9 4.7 12 4.7s2.9-1.8 3.8-1.4l4.3 1.6c1.2.5 1.7 1.3 1.7 2.5V9c0 1.2-.7 1.8-1.9 1.6l-2.3-.4v8.6c0 1.5-.7 2.2-2.2 2.2H8.6c-1.5 0-2.2-.7-2.2-2.2v-8.6l-2.3.4C2.9 10.8 2.2 10.2 2.2 9V7.4c0-1.2.5-2 1.7-2.5Z"/>',
  artist: '<path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2"/>',
  palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="9" r="1"/><circle cx="14" cy="7" r="1"/><circle cx="17" cy="12" r="1"/><path d="M7 18c-2-4 5-7 6-3 1 2-2 4-1 6"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  import: '<path d="M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  moon: '<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z"/>',
  battery: '<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 10v4M5 10h11v4H5Z" fill="currentColor"/>',
};
const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.disc}</svg>`;
const button = (name, label, action, extra = '') => `<button class="icon-button ${extra}" data-action="${action}" aria-label="${label}" title="${label}">${icon(name)}</button>`;
const themes = {
  obsidian: { name: '唱片馆', index: '01', art: 'cover', description: '黑金音乐库，配合封面取色的播放页与独立歌词页。', note: '专辑封面优先 / 黑金曲库 / 独立播放与歌词' },
  paper: { name: '曲库', index: '02', art: 'cover', description: '歌曲、专辑、艺术家和文件夹，按你的习惯找到音乐。', note: '本地分类优先 / 黑金曲库 / 共用播放与独立歌词页面' },
  flow: { name: '静听', index: '03', art: 'cover', description: '减少入口和信息，打开播放器就能回到喜欢的声音。', note: '继续聆听优先 / 黑金曲库 / 共用播放与独立歌词页面' },
};
const playbackStyles = {
  cover: { name: '专辑封面', description: '留白与大封面' },
  vinyl: { name: '唱片', description: '旋转唱片与唱臂' },
  immersive: { name: '沉浸大图', description: '封面铺满背景' },
};
const playbackModes = { repeat: { name: '列表循环', icon: 'repeat' }, single: { name: '单曲循环', icon: 'repeat-one' }, shuffle: { name: '随机播放', icon: 'shuffle' } };
const recordStyles = {
  black: { name: '纯黑胶', description: '细密唱纹 · 深黑光泽', texture: 'black' },
  clear: { name: '烟熏透明', description: '烟灰纹理 · 半透树脂', texture: 'smoke' },
  aurora: { name: '冰蓝反光', description: '冰蓝流光 · 珠光唱纹', texture: 'blue' },
  matte: { name: '石墨磨砂', description: '石墨灰调 · 柔和光泽', texture: 'black' },
  pearl: { name: '珠光贝母', description: '暖白底色 · 柔和虹彩', texture: 'smoke' },
  dusk: { name: '暮色渐变', description: '落日橘粉 · 梦幻紫', texture: 'smoke' },
  amber: { name: '琥珀透胶', description: '蜜糖琥珀 · 半透树脂', texture: 'smoke' },
  rose: { name: '樱花粉胶', description: '柔粉花雾 · 温润光泽', texture: 'smoke' },
  jade: { name: '翡翠流光', description: '翡翠青绿 · 细腻流光', texture: 'blue' },
};
const cartridgeColors = {
  original: { name: '原色', color: '#303235', highlight: '#505358', shadow: '#1c1e21' },
  silver: { name: '银白', color: '#c9cfce', highlight: '#f3f4ec', shadow: '#737e81' },
  gold: { name: '香槟金', color: '#bca078', highlight: '#ead7ae', shadow: '#725b40' },
  wine: { name: '酒红', color: '#914c58', highlight: '#be7d86', shadow: '#512c38' },
  ice: { name: '冰蓝', color: '#7da6c6', highlight: '#bad9e9', shadow: '#3d5e79' },
  jade: { name: '墨绿', color: '#527d70', highlight: '#8db4a0', shadow: '#2b493f' },
};
// Face plates align with the sprite; its dark edges, needle and screw slots stay visible.
const cartridgeFaces = {
  simple: 'M619 1025 L651 1038 Q658 1041 655 1049 L620 1139 Q618 1147 610 1143 L579 1131 Q572 1128 576 1118 L610 1032 Q613 1023 619 1025Z',
  classic: 'M620 981 L691 1001 Q698 1003 695 1011 L652 1150 Q650 1157 643 1154 L570 1133 Q564 1131 567 1123 L607 992 Q610 979 620 981Z',
};
const cartridgeSlots = 'M596 1072 Q604 1074 601 1084 L592 1116 Q588 1129 580 1126 Q571 1123 575 1111 L585 1080 Q588 1069 596 1072Z M656 1089 Q664 1091 661 1101 L652 1133 Q648 1146 640 1143 Q631 1140 635 1128 L645 1097 Q648 1086 656 1089Z';
let cartridgeId = 0;
function tonearmLayers(arm) {
  const finish = cartridgeColors[state.cartridgeColor], id = `cartridge-${++cartridgeId}`;
  return `<img src="./mobile/assets/turntable/${tonearmStyles[arm].file}" alt="" draggable="false">${state.cartridgeColor === 'original' ? '' : `<svg class="cartridge-finish" viewBox="0 0 1254 1254" aria-hidden="true"><defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="586" y1="${arm === 'simple' ? 1081 : 1051}" x2="${arm === 'simple' ? 643 : 674}" y2="${arm === 'simple' ? 1102 : 1077}"><stop offset="0" stop-color="${finish.highlight}"/><stop offset=".3" stop-color="${finish.color}"/><stop offset=".7" stop-color="${finish.color}"/><stop offset="1" stop-color="${finish.shadow}"/></linearGradient><mask id="${id}-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254"><path d="${cartridgeFaces[arm]}" fill="white"/>${arm === 'classic' ? `<path d="${cartridgeSlots}" fill="black"/>` : ''}</mask></defs><path d="${cartridgeFaces[arm]}" fill="url(#${id})" opacity=".94" mask="url(#${id}-mask)"/></svg>`}`;
}
function tonearmSprite(arm, style = '') {
  return `<span class="tonearm-sprite" data-tonearm-sprite="${arm}" style="${style}">${tonearmLayers(arm)}</span>`;
}
const stylusLights = {
  ruby: { name: '暖红', color: '#ed593e' },
  amber: { name: '琥珀', color: '#e9b35d' },
  ice: { name: '冰蓝', color: '#70bfff' },
  off: { name: '关闭', color: '#7b7d80' },
};
const tonearmStyles = {
  simple: { name: '简约唱臂', description: '纤细金属 · 轻盈长臂', file: 'tonearm-slim.png', lightX: '86.9%', lightY: '84.2%', left: '42.15%', top: '-4.81%', size: '95.7%', pivot: '90% 9%', sweep: 19 },
  classic: { name: '经典机械', description: '金属质感 · 写实细节', file: 'tonearm-v2.png', lightX: '82.3%', lightY: '80.1%', left: '42%', top: '-2.2%', size: '86%', pivot: '85% 15%', sweep: 20 },
};
const recordTexture = style => `<span class="record-surface"><img class="record-texture" src="./mobile/assets/turntable/${recordStyles[style].texture}-v2.png" alt="" draggable="false"><i class="record-tint"></i></span>`;
const recordSpeeds = {
  slow: { name: '慢速', seconds: 32, note: '舒缓转动' },
  standard: { name: '标准', seconds: 22, note: '默认节奏' },
  fast: { name: '快速', seconds: 12, note: '轻快转动' },
};
const tracks = [
  { id: 'coast', title: '山海之间', artist: '陈屿', album: '给远方的信', english: 'BETWEEN SEA & SKY', image: 'ocean', duration: 248, format: 'FLAC', detail: '24 bit / 96 kHz', color: '#8d7365', lines: ['天色慢慢落在海面', '晚风翻过无人的山', '沿着潮汐走了很远', '把喧嚣留在世界之外', '在山与海之间', '听见心跳慢慢舒展', '让时间停在这一瞬间', '你和风 都在身边'] },
  { id: 'mountain', title: '雪线', artist: '林间来信', album: '白日远行', english: 'ABOVE THE SILENCE', image: 'mountain', duration: 226, format: 'FLAC', detail: '24 bit / 192 kHz', color: '#628797', lines: ['清晨醒在远山之外', '一束光越过山脊', '把未说的话收进口袋', '沿雪线向天空走去', '风吹过了你的名字', '世界安静得像一封信', '此刻不必追问归期', '前方有光 也有你'] },
  { id: 'forest', title: '森呼吸', artist: '眠山', album: '缓慢生长', english: 'SLOW GROWING', image: 'forest', duration: 284, format: 'WAV', detail: '24 bit / 48 kHz', color: '#657d64', lines: ['一片叶子落在掌心', '阳光从树影里经过', '没有人催促这场雨', '森林自有它的呼吸', '让脚步再轻一点', '让每个念头慢慢沉静', '世界是一座绿色岛屿', '在这里 与自己相遇'] },
  { id: 'desert', title: '日落以西', artist: '陈屿', album: '落日来信', english: 'WEST OF THE SUN', image: 'desert', duration: 237, format: 'FLAC', detail: '24 bit / 96 kHz', color: '#b58c70', lines: ['日落以西还有一片海', '沙丘收藏过所有对白', '风把时间吹成了线', '我们在黄昏里等待', '有些答案不必寻找', '有些路值得慢慢走完', '最后一束光停在肩上', '明天 依然向远方'] },
];
let stored = {};
try { stored = JSON.parse(localStorage.getItem('sovel-preferences') || '{}') || {}; } catch { /* Preferences are optional. */ }
const params = new URLSearchParams(location.search);
const initialTheme = params.get('theme') || stored.theme;
const state = {
  theme: themes[initialTheme] ? initialTheme : 'obsidian',
  orientation: params.get('orientation') === 'landscape' ? 'landscape' : 'portrait',
  view: params.get('view') === 'focus' ? 'focus' : 'overview',
  device: params.get('device') === '1',
  focus: params.get('page') === 'about' ? 'player' : ['library', 'player', 'lyrics'].includes(params.get('page')) ? params.get('page') : 'library',
  pages: { library: 'library', player: params.get('page') === 'about' ? 'about' : 'player', lyrics: 'lyrics' },
  art: '', playing: false, current: 0, position: 94, mode: Object.hasOwn(playbackModes, stored.mode) ? stored.mode : 'repeat',
  backgroundPlayback: stored.backgroundPlayback !== false,
  scanRules: { filterSmall: false, minSizeKB: 100, ignoreHidden: true, includeSubfolders: true, ...stored.scanRules },
  recordStyle: recordStyles[stored.recordStyle] ? stored.recordStyle : 'clear',
  recordSpeed: Object.hasOwn(recordSpeeds, stored.recordSpeed) ? stored.recordSpeed : 'standard',
  cartridgeColor: Object.hasOwn(cartridgeColors, stored.cartridgeColor) ? stored.cartridgeColor : 'original',
  stylusLight: Object.hasOwn(stylusLights, stored.stylusLight) ? stored.stylusLight : 'ruby',
  tonearmStyle: Object.hasOwn(tonearmStyles, params.get('arm')) ? params.get('arm') : Object.hasOwn(tonearmStyles, stored.tonearmStyle) ? stored.tonearmStyle : 'simple',
  favorites: new Set(Array.isArray(stored.favorites) ? stored.favorites : []),
  albumLayout: stored.albumLayout === 'list' ? 'list' : 'cards', artistLayout: stored.artistLayout === 'list' ? 'list' : 'cards', collectionFilter: '', discoveryMix: null, queueIds: null,
  libraryTab: 'albums', filter: 'all', query: '', lyricSize: stored.lyricSize === 1 ? 1 : 0, sleepEnd: null, sleepMinutes: 0,
};
state.art = ['cover', 'vinyl', 'immersive'].includes(params.get('art') || stored.art) ? (params.get('art') || stored.art) : themes[state.theme].art;
state.libraryTab = state.theme === 'obsidian' ? 'albums' : 'tracks';
if (state.device) {
  state.view = 'focus';
  state.orientation = matchMedia('(orientation: landscape)').matches ? 'landscape' : 'portrait';
}
if (state.orientation === 'landscape') state.view = 'focus';
const audio = new Audio();
audio.preload = 'metadata';
audio.volume = .7;
const currentTrack = () => tracks[state.current];
const time = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const save = () => {
  try { localStorage.setItem('sovel-preferences', JSON.stringify({ theme: state.theme, albumLayout: state.albumLayout, artistLayout: state.artistLayout, art: state.art, recordStyle: state.recordStyle, recordSpeed: state.recordSpeed, stylusLight: state.stylusLight, tonearmStyle: state.tonearmStyle, cartridgeColor: state.cartridgeColor, lyricSize: state.lyricSize, mode: state.mode, backgroundPlayback: state.backgroundPlayback, scanRules: state.scanRules, favorites: [...state.favorites] })); } catch { /* Private mode may disable storage. */ }
  // Keep an explicitly styled preview link consistent with later choices on that page.
  const url = new URL(location.href);
  if (url.searchParams.has('theme')) url.searchParams.set('theme', state.theme);
  if (url.searchParams.has('art')) url.searchParams.set('art', state.art);
  if (url.href !== location.href) history.replaceState(null, '', url);
};
const placeholderNames = { album: ['album-amber', 'album-tidal', 'album-dusk', 'album-dune'], artist: ['artist-bronze', 'artist-slate'] };
const normalizedArtworkKey = (value = '') => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const knownArtworkKey = (value = '') => !!normalizedArtworkKey(value) && !/^(未知|unknown)/i.test(value.trim());
function placeholderUrl(kind, key) {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  return `./mobile/assets/placeholders/${placeholderNames[kind][(hash >>> 0) % placeholderNames[kind].length]}.jpg`;
}
function albumFallback(song) {
  const artist = knownArtworkKey(song.albumArtist) ? song.albumArtist : song.artist;
  const key = knownArtworkKey(song.album) ? ['album', normalizedArtworkKey(artist), normalizedArtworkKey(song.album)] : ['track', normalizedArtworkKey(artist), normalizedArtworkKey(song.title) || song.id || ''];
  return placeholderUrl('album', JSON.stringify(key));
}
const coverUrl = song => song.image ? `./assets/${song.image}.jpg` : albumFallback(song);
const artistFallback = name => knownArtworkKey(name) ? placeholderUrl('artist', normalizedArtworkKey(name)) : './mobile/assets/placeholders/artist-bronze.jpg';
const albumArt = (song, classes = '') => `<div class="album-art ${classes}" style="--art-image:url('${escape(coverUrl(song))}')"><img src="${escape(coverUrl(song))}" data-fallback="${albumFallback(song)}" alt="${escape(song.album)}概念封面" draggable="false"/><div class="album-art-type"><span>${escape(song.artist)}</span><strong>${escape(song.album)}</strong><small>${song.english}</small></div><span class="album-edition">Sovel RECORDS · 2026</span></div>`;
const statusbar = () => `<div class="statusbar"><span>09:41 <span class="status-hifi">HiFi</span></span><span>${icon('headphones')}<span>82</span>${icon('battery')}</span></div>`;
const favorite = () => button('heart', state.favorites.has(currentTrack().id) ? '取消喜欢' : '喜欢这首歌', 'favorite', state.favorites.has(currentTrack().id) ? 'is-favorite' : '');
function transport() {
  const mode = playbackModes[state.mode].icon;
  const modeLabel = `${playbackModes[state.mode].name}，点击切换播放方式`;
  return `<div class="transport unified-transport">${button(mode, modeLabel, 'mode', 'mode-button')}${button('previous', '上一首', 'previous')}${button(state.playing ? 'pause' : 'play', state.playing ? '暂停' : '播放', 'play', 'main-play')}${button('next', '下一首', 'next')}${button('queue', '播放队列', 'queue', 'queue-button')}</div>`;
}
function playbackControls() { return `<div class="playback-controls">${progress()}${transport()}</div>`; }
let platterTurns = 0;
let platterStamp = performance.now();
let platterRunning = false;
let platterDuration = recordSpeeds[state.recordSpeed].seconds;
function turntableTime() {
  const now = performance.now();
  if (platterRunning) platterTurns = (platterTurns + (now - platterStamp) / 1000 / platterDuration) % 1;
  platterStamp = now;
  platterRunning = state.playing;
  platterDuration = recordSpeeds[state.recordSpeed].seconds;
  return platterTurns;
}
const tonearmMotion = new WeakMap();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const tonearmAngle = song => tonearmStyles[state.tonearmStyle].sweep * Math.max(0, Math.min(1, state.position / (song.duration || 1)));
function updateTonearms() {
  const song = currentTrack(), stamp = performance.now();
  $$('.tonearm').forEach(arm => {
    const previous = tonearmMotion.get(arm);
    const expected = previous ? previous.position + (previous.playing ? (stamp - previous.stamp) / 1000 : 0) : state.position;
    const changed = !previous || previous.playing !== state.playing || previous.track !== song.id;
    const seeked = Math.abs(state.position - expected) > 1.3;
    if (!changed && !seeked && previous.reduced === reducedMotion.matches) return;
    const transform = getComputedStyle(arm).transform;
    arm.getAnimations().forEach(animation => animation.cancel());
    const motion = { playing: state.playing, track: song.id, position: state.position, stamp, reduced: reducedMotion.matches };
    tonearmMotion.set(arm, motion);
    const target = state.playing ? tonearmAngle(song) : -7;
    const follow = () => {
      if (!arm.isConnected || tonearmMotion.get(arm) !== motion) return;
      arm.getAnimations().forEach(animation => animation.cancel());
      const angle = state.playing ? tonearmAngle(currentTrack()) : -7;
      arm.style.transform = `rotate(${angle}deg)`;
      arm.dataset.state = state.playing ? 'tracking' : 'parked';
      if (state.playing && !reducedMotion.matches) arm.animate([
        { transform: `rotate(${angle}deg)` }, { transform: 'rotate(20deg)' },
      ], { duration: Math.max(1, (song.duration - state.position) * 1000), easing: 'linear', fill: 'forwards' });
    };
    // New views start at the current groove; opening settings or changing
    // record material must never replay the landing movement.
    if (!previous || reducedMotion.matches) { follow(); return; }
    arm.style.transform = transform;
    arm.dataset.state = state.playing ? 'landing' : 'lifting';
    const landing = arm.animate([{ transform }, { transform: `rotate(${target}deg)` }], {
      duration: changed ? 900 : 240, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards',
    });
    landing.onfinish = follow;
  });
}
reducedMotion.addEventListener('change', updateTonearms);
function vinylArtwork(song) {
  const armSkin = tonearmStyles[state.tonearmStyle];
  return `<div class="vinyl-stage" data-record-style="${state.recordStyle}" data-stylus-light="${state.stylusLight}" style="--stylus-color:${stylusLights[state.stylusLight].color}" aria-label="${recordStyles[state.recordStyle].name}与随播放进度移动的唱针">
    <div class="vinyl-shadow"></div>
    <div class="vinyl-record" style="animation-duration:${recordSpeeds[state.recordSpeed].seconds}s;animation-delay:-${turntableTime() * recordSpeeds[state.recordSpeed].seconds}s">
      ${recordTexture(state.recordStyle)}
      <div class="vinyl-label" style="background-image:url('${escape(coverUrl(song))}')"></div>
      <span class="vinyl-spindle"></span>
    </div>
    <div class="vinyl-sheen"></div>
    <div class="tonearm" style="transform-origin:${armSkin.pivot};transform:rotate(${state.playing ? tonearmAngle(song) : -7}deg)" aria-hidden="true">
      <i class="stylus-glow" style="left:${armSkin.lightX};top:${armSkin.lightY}"></i>
      ${tonearmSprite(state.tonearmStyle, `left:${armSkin.left};top:${armSkin.top};width:${armSkin.size};height:${armSkin.size}`)}
    </div>

  </div>`;
}
function lyricPreview(song) {
  const line = Math.min(7, Math.floor(state.position / song.duration * 8));
  return `<button class="player-lyric-preview" data-action="navigate-lyrics" aria-label="查看完整歌词"><span data-preview-current>${escape(song.lines?.[line] || '此刻，专注聆听')}</span><small data-preview-next>${escape(song.lines?.[line + 1] || (song.lines ? '余音，慢慢散去' : '这首本地音乐还没有歌词'))}</small></button>`;
}
function progress() {
  const song = currentTrack();
  return `<div class="progress-block"><input type="range" aria-label="播放进度" min="0" max="${song.duration}" value="${state.position}" step="1" data-progress style="--progress:${state.position / song.duration * 100}%"/><div class="time-labels"><span data-time>${time(state.position)}</span><span>${time(song.duration)}</span></div></div>`;
}
function miniPlayer() {
  const song = currentTrack();
  return `<div class="mini-player"><button class="mini-song" data-action="navigate-player" aria-label="打开播放页面"><span class="mini-record" aria-hidden="true" style="animation-duration:${recordSpeeds[state.recordSpeed].seconds}s;animation-delay:-${turntableTime() * recordSpeeds[state.recordSpeed].seconds}s">${recordTexture('black')}<i class="mini-record-label" style="background-image:url('${escape(coverUrl(song))}')"></i><i class="mini-record-spindle"></i></span><span class="mini-copy"><strong>${escape(song.title)}</strong><small> · ${escape(song.artist)}</small></span></button>${button(state.playing ? 'pause' : 'play', state.playing ? '暂停' : '播放', 'play', 'mini-play')}${button('queue', '播放队列', 'queue')}</div>`;
}
function bottomNav() {
  return `<nav class="bottom-nav" aria-label="音乐库分类"><button class="${state.filter === 'all' ? 'active' : ''}" aria-current="${state.filter === 'all' ? 'page' : 'false'}" data-action="filter-all">音乐库</button><button class="${state.filter === 'favorites' ? 'active' : ''}" aria-current="${state.filter === 'favorites' ? 'page' : 'false'}" data-action="filter-favorites">我喜欢</button><button data-action="settings">设置</button></nav>`;
}
function trackRow(song, index, suffix = '') {
  return `<button class="track-row ${index === state.current ? 'current' : ''}" data-track="${index}"><img src="${escape(coverUrl(song))}" data-fallback="${albumFallback(song)}" alt=""/><span class="track-text"><strong>${escape(song.title)}</strong><small>${escape(song.artist)} · ${escape(song.album)}</small></span><span class="track-end">${index === state.current ? '<span class="equalizer"><i></i><i></i><i></i></span>' : `<small>${suffix || time(song.duration)}</small>`}</span></button>`;
}
function localDiscovery() {
  const date = new Date(), day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const daily = [...tracks].sort((a, b) => a.id.localeCompare(b.id));
  let seed = 2166136261;
  for (const char of day) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  const random = () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = daily.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [daily[i], daily[j]] = [daily[j], daily[i]];
  }
  const current = currentTrack();
  const related = tracks.filter(t => t.id !== current.id).map(track => ({ track,
    score: (track.artist === current.artist ? 12 + (track.album === current.album ? 6 : 0) : 0) + (state.favorites.has(track.id) ? 2 : 0),
  })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.track.id.localeCompare(b.track.id)).map(item => item.track).slice(0, 30);
  return { daily: daily.slice(0, 30), related, favorites: tracks.filter(t => state.favorites.has(t.id)) };
}
function libraryHighlights() {
  const { daily, related, favorites } = localDiscovery(), current = currentTrack();
  const cards = [
    { kind: 'daily', kicker: 'DAILY MIX', title: '每日精选', detail: `今天的 ${daily.length} 首 · 每日更新`, cover: daily[0], symbol: 'play' },
    { kind: 'resume', kicker: '继续聆听', title: current.title, detail: current.artist, cover: current, symbol: 'play' },
    { kind: 'related', kicker: 'MORE TO LOVE', title: '猜你喜欢', detail: related.length ? `同歌手与收藏 · ${related.length} 首` : '收藏歌曲，发现更多', cover: related[0], symbol: 'disc' },
    { kind: 'favorites', kicker: 'YOUR FAVORITES', title: '喜欢的音乐', detail: `${favorites.length} 首珍藏 · 随时重听`, cover: favorites[0], symbol: 'heart' },
  ];
  return `<div class="highlights-rail" role="region" aria-label="音乐精选卡片">${cards.map(card => `<button class="highlight-card highlight-${card.kind}" data-action="discovery-${card.kind}" aria-label="${card.kind === 'resume' ? '继续聆听上次的歌曲' : card.title}"><span class="highlight-copy"><small>${card.kicker}</small><strong>${escape(card.title)}</strong><span>${escape(card.detail)}</span></span><span class="highlight-art">${card.cover ? `<img src="${escape(coverUrl(card.cover))}" data-fallback="${albumFallback(card.cover)}" alt=""/>` : `<span class="highlight-placeholder">${icon(card.symbol)}</span>`}<i>${icon(card.symbol)}</i></span></button>`).join('')}</div>`;
}
function library() {
  const source = state.discoveryMix ? state.discoveryMix.ids.map(id => tracks.find(t => t.id === id)).filter(Boolean) : tracks;
  const filtered = source.filter(t => (!state.collectionFilter || contextAlbumKey(t) === state.collectionFilter) && (state.filter !== 'favorites' || state.favorites.has(t.id)) && `${t.title}${t.artist}${t.album}`.toLowerCase().includes(state.query.toLowerCase()));
  const albums = [...new Map(filtered.map(t => [contextAlbumKey(t), t])).values()];
  const collection = state.libraryTab !== 'tracks';
  const layout = state.libraryTab === 'artists' ? state.artistLayout : state.albumLayout;
  const title = state.filter === 'favorites' ? '我喜欢' : (state.theme === 'paper' ? '本地音乐' : state.theme === 'flow' ? '慢慢听' : '我的音乐');
  return `<div class="library-page layout-${state.theme} collection-focused"><header class="library-header"><div><p class="app-eyebrow">${state.theme === 'paper' ? 'YOUR LOCAL COLLECTION' : state.theme === 'flow' ? 'A MOMENT FOR YOURSELF' : 'YOUR MUSIC, YOUR WORLD'}</p><h2>${title}<span class="heading-dot">.</span></h2></div><div>${button('search', '搜索音乐', 'search')}</div></header><div class="library-scroll"><div class="library-main">${state.query ? `<button class="search-result" data-action="clear-search">搜索：${escape(state.query)} ${icon('close')}</button>` : ''}</div>${libraryHighlights()}<section class="collection-section"><div class="section-title"><div class="library-tabs"><button class="${state.libraryTab === 'albums' ? 'active' : ''}" data-action="tab-albums">专辑</button><button class="${state.libraryTab === 'tracks' ? 'active' : ''}" data-action="tab-tracks">歌曲</button><button class="${state.libraryTab === 'artists' ? 'active' : ''}" data-action="tab-artists">艺术家</button></div><span>${filtered.length} 首收藏</span></div>${!filtered.length ? `<div class="empty-state">${icon('heart')}<strong>${state.query ? '没有找到这首音乐' : state.discoveryMix ? '暂时没有合适的歌曲' : '把喜欢的声音留下来'}</strong><p>${state.query ? '换一个歌名或艺术家试试' : state.discoveryMix ? '收藏更多音乐，或先听听每日精选' : '在播放页点一下爱心，就会出现在这里'}</p></div>` : collection ? libraryCollections(filtered, albums, layout) : `<div class="collection-toolbar">${state.discoveryMix ? `<button data-action="discovery-clear" aria-label="返回全部音乐">${icon('back')}${state.discoveryMix.title}</button>` : '<span class="collection-label">全部歌曲</span>'}<small>${filtered.length} 首歌曲</small></div><div class="track-list">${filtered.map(song => trackRow(song, tracks.indexOf(song))).join('')}</div>`}</section></div><div class="library-bottom">${miniPlayer()}${bottomNav()}</div></div>`;
}
function libraryCollections(filtered, albums, layout) {
  const artist = state.libraryTab === 'artists';
  const names = [...new Set(filtered.map(t => t.artist))];
  return `<div class="collection-toolbar"><button data-action="collection-layout" aria-label="${artist ? '艺术家' : '专辑'}切换为${layout === 'cards' ? '列表' : '卡片'}">${icon(layout === 'cards' ? 'grid' : 'list')}<span>${layout === 'cards' ? '封面视图' : '列表视图'}</span></button><small>${artist ? `${names.length} 位艺术家` : `${albums.length} 张专辑`} · ${filtered.length} 首</small></div>
    <div class="collection-items collection-${layout} ${artist ? 'portrait-items' : 'sleeve-items'}">${artist ? names.map(name => {
      const songs = filtered.filter(t => t.artist === name), portrait = songs.find(t => t.artistImage)?.artistImage;
      return `<button class="collection-item" data-artist="${escape(name)}"><span class="collection-portrait"><span>${icon('artist')}<img src="${escape(portrait || artistFallback(name))}" data-fallback="${artistFallback(name)}" alt=""/></span></span><span class="collection-copy"><strong>${escape(name)}</strong><small>${new Set(songs.map(contextAlbumKey)).size} 张专辑 · ${songs.length} 首歌曲</small></span>${layout === 'list' ? icon('forward') : ''}</button>`;
    }).join('') : albums.map(song => {
      const count = filtered.filter(t => contextAlbumKey(t) === contextAlbumKey(song)).length;
      return `<button class="collection-item" data-library-album="${escape(contextAlbumKey(song))}" aria-label="打开 ${escape(song.album)}"><span class="collection-sleeve">${albumArt(song)}<span class="collection-count">${icon('disc')}${count} 首</span></span><span class="collection-copy"><strong>${escape(song.album)}</strong><small>${escape(song.albumArtist || song.artist)}</small></span>${layout === 'list' ? `<span class="collection-list-count">${count} 首</span>${icon('forward')}` : ''}</button>`;
    }).join('')}</div>`;
}
function player() {
  const song = currentTrack();
  return `<div class="player-page art-${state.art}" style="--track-color:${song.color}"><div class="ambient-cover" style="background-image:url('${escape(coverUrl(song))}')"></div>
    <div class="player-body"><div class="art-stage"><div class="cover-stage">${albumArt(song, 'main-album')}</div>${vinylArtwork(song)}</div>
    <section class="player-info"><div class="song-heading"><div><h2>${escape(song.title)}</h2><p>${escape(song.artist)}${song.album ? ` <span>· ${escape(song.album)}</span>` : ''}</p></div>${favorite()}</div><button class="quality-pill" data-action="output"><span>${song.url ? 'LOCAL' : 'Hi-Res'}</span>${song.format} <i>·</i> ${song.url ? '文件试听' : song.detail}${icon('forward')}</button>${lyricPreview(song)}${playbackControls()}</section></div></div>`;
}
function lyrics() {
  const song = currentTrack();
  return `<div class="lyrics-page" style="--track-color:${song.color}"><div class="lyric-ambient" style="background-image:url('${escape(coverUrl(song))}')"></div><div class="lyrics-song"><img src="${escape(coverUrl(song))}" data-fallback="${albumFallback(song)}" alt=""/><div><strong>${escape(song.title)}</strong><small>${escape(song.artist)} · ${escape(song.album)}</small></div><button class="icon-button lyric-font" data-action="lyric-size" aria-label="切换歌词字号">Aa</button>${favorite()}</div><div class="lyrics-stage ${state.lyricSize ? 'large-type' : ''}">${song.lines ? `<div class="lyrics-scroll" tabindex="0" aria-label="歌词，点击歌词可跳转播放位置"><div class="lyrics-spacer"></div>${song.lines.map((line, i) => `<button class="lyric-line" data-lyric="${i}" style="--line-index:${i}"><span>${escape(line)}</span><small>${time(lyricTime(i))} ${icon('play')}</small></button>`).join('')}<div class="lyrics-spacer end-spacer"></div></div>` : `<div class="empty-state">${icon('lyrics')}<strong>此刻，专注聆听</strong><p>这首本地音乐还没有歌词</p></div>`}</div><div class="lyrics-footer">${playbackControls()}</div></div>`;
}
let contextCollection = null;
const playerPages = ['about', 'player', 'lyrics'];
const playerPageLabels = ['歌曲详情', '正在播放', '完整歌词'];
function detailRows(rows) {
  return `<dl class="context-details">${rows.map(([label, value]) => `<div class="${['文件名', '文件路径'].includes(label) ? 'detail-stacked' : ''}"><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>`;
}
const contextAlbumKey = song => JSON.stringify([song.albumArtist || song.artist, song.album]);
function contextAlbums(song) {
  const groups = new Map();
  for (const track of tracks) {
    const key = contextAlbumKey(track);
    if (!groups.has(key)) groups.set(key, { key, title: track.album, artist: track.albumArtist || track.artist, cover: track, tracks: [] });
    groups.get(key).tracks.push(track);
  }
  return [...groups.values()].filter(album => album.tracks.some(track => track.artist === song.artist)).sort((a, b) => Number(b.key === contextAlbumKey(song)) - Number(a.key === contextAlbumKey(song)) || a.title.localeCompare(b.title, 'zh-CN'));
}
function contextAlbumCards(albums, expanded = false) {
  return `<div class="context-albums"><div class="context-section-heading"><h3>歌手专辑</h3>${expanded ? '<button data-context-collection="all">返回歌曲信息</button>' : albums.length > 4 ? `<button data-context-collection="artist" aria-label="查看全部歌手专辑">全部 ${albums.length} 张 ›</button>` : `<small>曲库收录 · ${albums.length} 张</small>`}</div><div class="context-album-grid">${(expanded ? albums : albums.slice(0, 4)).map(album => `<button class="context-album-card" data-context-album="${escape(album.key)}" data-album-from="${expanded ? 'artist' : 'details'}" aria-label="打开专辑：${escape(album.title)}，${album.tracks.length} 首"><span class="context-album-artwork"><img src="${escape(coverUrl(album.cover))}" data-fallback="${albumFallback(album.cover)}" alt=""/><span class="context-album-count">${icon('disc')}${album.tracks.length} 首</span></span><strong>${escape(album.title)}</strong><small>${escape(album.artist)}</small></button>`).join('')}</div>${albums.length ? '' : '<p class="context-empty">曲库里还没有这位歌手的专辑。</p>'}</div>`;
}
function songContext() {
  const song = currentTrack();
  const artistTracks = tracks.filter(t => t.artist === song.artist);
  const artistImage = song.artistImage || artistTracks.find(t => t.artistImage)?.artistImage;
  const albums = contextAlbums(song);
  const albumTracks = albums.find(album => album.key === contextAlbumKey(song))?.tracks || [];
  const selectedAlbum = contextCollection?.kind === 'album' ? albums.find(album => album.key === contextCollection.key) : null;
  const score = t => Number(t.artist === song.artist) * 4 + Number(t.album === song.album && t.artist === song.artist) * 2 + Number(state.favorites.has(t.id));
  const related = tracks.filter(t => t.id !== song.id).sort((a, b) => score(b) - score(a)).slice(0, 4);
  const list = contextCollection?.kind === 'album' ? selectedAlbum?.tracks || [] : related;
  const audioRows = [['格式', song.format], ['时长', time(song.duration)], ['采样率', song.url ? '尚未解析' : song.detail.split(' / ')[1]], ['位深', song.url ? '尚未解析' : song.detail.split(' / ')[0]], ['声道', song.url ? '尚未解析' : '2 声道'], ['文件大小', song.size !== undefined ? `${(song.size / 1024 / 1024).toFixed(2)} MiB` : '—']];
  const fileName = song.fileName || `${song.title}.${song.format.toLowerCase()}`;
  const fileRows = [['文件名', fileName], ['文件路径', song.url ? '浏览器未提供文件路径' : `Music/${song.artist}/${song.album}/${fileName}（示例）`], ['修改时间', song.mtime ? new Date(song.mtime).toLocaleString('zh-CN', { hour12: false }) : '—']];
  return `<div class="song-context-page"><div class="context-scroll">
    <section class="context-identity"><div class="context-hero"><img src="${escape(coverUrl(song))}" data-fallback="${albumFallback(song)}" alt=""/><div><h2>${escape(song.title)}</h2><p>${escape(song.artist)}</p></div></div>
      <div class="context-links"><button data-context-collection="artist" aria-label="查看歌手：${escape(song.artist)}"><span class="context-artist-avatar" aria-hidden="true">${icon('artist')}<img src="${escape(artistImage || artistFallback(song.artist))}" data-fallback="${artistFallback(song.artist)}" alt=""/></span><strong><span class="context-link-label">歌手 · </span>${escape(song.artist)}</strong><small>${artistTracks.length} 首</small>${icon('forward')}</button><button data-context-collection="album" aria-label="查看专辑：${escape(song.album)}"><img class="context-album-cover" src="${escape(coverUrl(song))}" data-fallback="${albumFallback(song)}" alt=""/><strong><span class="context-link-label">专辑 · </span>${escape(song.album)}</strong><small>${albumTracks.length} 首</small>${icon('forward')}</button></div>
      ${contextCollection ? '' : `${state.orientation === 'landscape' ? '' : contextAlbumCards(albums)}<h3 class="context-section-title">音频参数</h3><dl class="context-audio">${audioRows.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl><p class="context-note">${song.url ? '浏览器尚未解析音频标签' : '示例参数 · 非真实文件检测结果'}</p>`}
    </section>
    <section class="context-more">
      ${!contextCollection && state.orientation === 'landscape' ? contextAlbumCards(albums) : ''}
      ${contextCollection?.kind === 'artist' ? contextAlbumCards(albums, true) : `<div class="context-section-heading"><h3>${contextCollection?.kind === 'album' ? '专辑曲目' : '猜你喜欢'}</h3>${contextCollection ? `<button data-context-collection="${contextCollection.from === 'artist' ? 'artist' : 'all'}">${contextCollection.from === 'artist' ? '返回歌手专辑' : '返回歌曲信息'}</button>` : '<small>来自你的曲库</small>'}</div>${selectedAlbum ? `<div class="context-album-summary"><img src="${escape(coverUrl(selectedAlbum.cover))}" data-fallback="${albumFallback(selectedAlbum.cover)}" alt=""/><div><strong>${escape(selectedAlbum.title)}</strong><small>${escape(selectedAlbum.artist)} · ${selectedAlbum.tracks.length} 首</small></div></div>` : ''}<div class="context-track-list">${list.map(t => `<button data-track="${tracks.indexOf(t)}" aria-label="播放 ${escape(t.title)}"><img src="${escape(coverUrl(t))}" data-fallback="${albumFallback(t)}" alt=""/><span><strong>${escape(t.title)}</strong><small>${escape(t.artist)} · ${escape(t.album)}</small></span>${icon('play')}</button>`).join('') || '<p class="context-empty">曲库里还没有更多歌曲，添加音乐后再来发现。</p>'}</div>`}
      ${contextCollection ? '' : `<h3 class="context-section-title">文件信息</h3>${detailRows(fileRows)}`}
    </section>
  </div><div class="context-footer">${playbackControls()}</div></div>`;
}
const pageFunctions = { library, player, lyrics, about: songContext };
function renderPage(page) {
  if (page === 'library') return library();
  return `<div class="playback-deck" style="--deck-art:url('${escape(coverUrl(currentTrack()))}')"><header class="page-header">${button('down', '返回音乐库', 'navigate-library')}<nav class="player-page-dots" aria-label="播放分页">${playerPages.map((p, i) => `<button data-action="navigate-${p}" aria-label="${playerPageLabels[i]}" aria-current="${p === page ? 'page' : 'false'}"><i class="${p === page ? 'is-current' : ''}"></i></button>`).join('')}</nav>${button('shirt', '打开播放外观', 'open-player-appearance')}</header><div class="playback-host">${pageFunctions[page]()}</div></div>`;
}
const pageNames = { library: ['我的音乐', 'LIBRARY'], player: ['正在播放', 'NOW PLAYING'], lyrics: ['独立歌词', 'LYRICS'] };
function render() {
  const railOffsets = new Map($$('.highlights-rail').map(rail => [rail.closest('[data-panel]').dataset.panel, rail.scrollLeft]));
  clearSwipe();
  document.body.dataset.theme = state.theme;
  document.body.dataset.orientation = state.orientation;
  document.body.dataset.view = state.view;
  document.body.dataset.device = state.device;
  document.body.classList.toggle('is-playing', state.playing);
  const gallery = $('#gallery');
  $$('.tonearm', gallery).forEach(arm => arm.getAnimations().forEach(animation => animation.cancel()));
  gallery.dataset.theme = state.theme;
  gallery.innerHTML = ['library', 'player', 'lyrics'].map((panel, i) => `<article class="device-card ${state.focus === panel ? 'is-focused' : ''}" data-panel="${panel}"><div class="device-caption"><span><b>0${i + 1}</b>${pageNames[panel][0]}</span><small>${pageNames[panel][1]}</small></div><div class="device"><div class="screen" data-page="${state.pages[panel]}" style="--track-color:${currentTrack().color}">${statusbar()}${renderPage(state.pages[panel])}</div></div><p class="device-footnote">${['收藏、浏览，让好音乐触手可及', '专注于声音，也专注于眼前的美', '一个独立页面，留给每一句共鸣'][i]}</p></article>`).join('');
  $$('.highlights-rail').forEach(rail => { rail.scrollLeft = railOffsets.get(rail.closest('[data-panel]').dataset.panel) || 0; });
  $$('.theme-option').forEach(el => { const active = el.dataset.theme === state.theme; el.classList.toggle('selected', active); el.setAttribute('aria-pressed', active); });
  $$('[data-orientation]').forEach(el => { const active = el.dataset.orientation === state.orientation; el.classList.toggle('active', active); el.setAttribute('aria-pressed', active); });
  $$('[data-focus]').forEach(el => { const active = el.dataset.focus === state.focus; el.classList.toggle('active', active); el.setAttribute('aria-current', active ? 'page' : 'false'); });
  $('#direction-copy').textContent = themes[state.theme].description;
  $('#design-note').textContent = themes[state.theme].note;
  $('#choose-direction').innerHTML = `主页布局设置 <span>↗</span>`;
  $('#view-toggle').innerHTML = `${state.view === 'focus' ? '三屏总览' : '单页体验'} <span>↗</span>`;
  $('#view-toggle').setAttribute('aria-pressed', state.view === 'focus');
  $('#fullscreen-link').href = `?device=1&theme=${state.theme}&page=${state.focus}&art=${state.art}`;
  updatePlaybackUI(true);
}
function lyricTime(index) { return Math.round(index / 8 * currentTrack().duration); }
let activeLyric = -1;
function updatePlaybackUI(force = false) {
  const song = currentTrack();
  turntableTime();
  document.body.classList.toggle('is-playing', state.playing);
  $$('[data-action="play"]').forEach(el => { el.innerHTML = icon(state.playing ? 'pause' : 'play'); el.setAttribute('aria-label', state.playing ? '暂停' : '播放'); el.title = state.playing ? '暂停' : '播放'; });
  $$('[data-time]').forEach(el => el.textContent = time(state.position));
  $$('[data-progress]').forEach(el => { if (document.activeElement !== el) el.value = state.position; el.style.setProperty('--progress', `${state.position / song.duration * 100}%`); });
  const index = Math.min(7, Math.floor(state.position / song.duration * 8));
  updateTonearms();
  $$('[data-action="mode"].mode-button').forEach(el => {
    el.innerHTML = icon(playbackModes[state.mode].icon);
    el.setAttribute('aria-label', `${playbackModes[state.mode].name}，点击切换播放方式`);
    el.title = el.getAttribute('aria-label');
  });
  if (index !== activeLyric || force) {
    $$('[data-preview-current]').forEach(el => el.textContent = song.lines?.[index] || '此刻，专注聆听');
    $$('[data-preview-next]').forEach(el => el.textContent = song.lines?.[index + 1] || (song.lines ? '余音，慢慢散去' : '这首本地音乐还没有歌词'));
    activeLyric = index;
    $$('.lyrics-scroll').forEach(list => {
      $$('.lyric-line', list).forEach((el, i) => { el.classList.toggle('active', i === index); el.classList.toggle('past', i < index); el.setAttribute('aria-current', i === index ? 'true' : 'false'); });
      const line = $('.lyric-line.active', list);
      if (line) list.scrollTop = line.offsetTop - list.offsetTop - list.clientHeight * .43 + line.clientHeight / 2;
    });
  }
}
function navigate(page, panel) {
  if (state.view === 'focus') { state.focus = page === 'about' ? 'player' : page; state.pages[state.focus] = page; }
  else state.pages[panel] = page;
  render();
}
function setTheme(theme) { state.theme = theme; state.libraryTab = theme === 'obsidian' ? 'albums' : 'tracks'; state.filter = 'all'; state.query = ''; state.pages = { library: 'library', player: 'player', lyrics: 'lyrics' }; save(); render(); }
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2600); }
async function playPause() {
  if (state.playing) { audio.pause(); state.playing = false; }
  else {
    if (currentTrack().url) {
      try { await audio.play(); state.playing = true; }
      catch { toast('浏览器无法播放此格式，请试试 MP3、WAV 或 FLAC 文件'); return; }
    } else state.playing = true;
  }
  updatePlaybackUI();
}
async function selectTrack(index, play = state.playing) {
  contextCollection = null;
  audio.pause(); state.playing = false; state.current = index; state.position = 0;
  const song = currentTrack();
  if (song.url) { audio.src = song.url; audio.load(); }
  else { audio.removeAttribute('src'); audio.load(); }
  render();
  if (play) await playPause();
}
function queuedTracks() { return state.queueIds ? state.queueIds.map(id => tracks.find(t => t.id === id)).filter(Boolean) : tracks; }
function nextTrack(delta = 1) {
  const queue = queuedTracks();
  if (!queue.length) return;
  const current = Math.max(0, queue.findIndex(t => t.id === currentTrack().id));
  let next = (current + delta + queue.length) % queue.length;
  if (state.mode === 'shuffle' && delta > 0 && queue.length > 1) next = (current + 1 + Math.floor(Math.random() * (queue.length - 1))) % queue.length;
  selectTrack(tracks.indexOf(queue[next]));
}
function seek(position) { state.position = Math.min(currentTrack().duration, Math.max(0, position)); if (currentTrack().url && Number.isFinite(audio.duration)) audio.currentTime = state.position; updatePlaybackUI(true); }
const dialog = $('#studio-dialog');
function showDialog(title, body, kind = '') {
  dialog.className = `studio-dialog ${kind}`;
  dialog.innerHTML = `<header><div><p class="eyebrow">Sovel · ${kind.includes('dark-settings') ? '偏好设置' : themes[state.theme].name}</p><h2 id="dialog-title">${title}</h2></div>${button('close', '关闭弹窗', 'close-dialog')}</header>${body}`;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}
function homeAppearance() {
  const homeDescriptions = { obsidian: '按专辑慢慢逛', paper: '分类清楚，选歌更快', flow: '打开就能继续听' };
  showDialog('主页布局', `<button class="settings-back" data-action="settings-style">${icon('back')}返回样式设置</button><p class="dialog-description">按你的习惯，浏览本地音乐。</p><div class="style-sections">
    <section class="style-section" aria-labelledby="home-style-title"><div class="style-section-heading"><h3 id="home-style-title">主页布局</h3><span>黑金音乐库</span></div><div class="style-grid">${Object.entries(themes).map(([value, theme]) => `<button class="style-card" data-home-style="${value}" aria-pressed="${state.theme === value}"><span class="style-preview home-style-preview" aria-hidden="true"><span class="mini-home mini-home-${value}"><i class="mini-heading"></i>${value === 'paper' ? '<span class="mini-shortcuts"><i></i><i></i><i></i><i></i></span><span class="mini-track-lines"><i></i><i></i><i></i></span>' : `<img src="${escape(coverUrl(currentTrack()))}" data-fallback="${albumFallback(currentTrack())}" alt=""/><span class="${value === 'obsidian' ? 'mini-album-grid' : 'mini-track-lines'}"><i></i><i></i></span>`}<i class="mini-bottom"></i></span></span><strong>${theme.name}</strong><small>${homeDescriptions[value]}</small><span class="style-selected" aria-hidden="true">${icon('check')}</span></button>`).join('')}</div></section>

    </div><div class="style-footer"><p class="style-saved" aria-live="polite"></p><button class="dialog-primary" data-action="settings-style">完成 ${icon('check')}</button></div>`, 'dark-settings style-settings home-style-settings');
  updateStyleSelection();
}
function updateStyleSelection() {
  $$('[data-home-style]', dialog).forEach(el => el.setAttribute('aria-pressed', el.dataset.homeStyle === state.theme));
  $('.style-saved', dialog).textContent = `${themes[state.theme].name}，已自动保存`;
}
function recordAppearance() {
  showDialog('唱片样式', `<button class="settings-back" data-action="settings-style">${icon('back')}返回样式设置</button><p class="dialog-description">为唱片挑一种质感。切回唱片模式时，使用你选好的样式。</p><div class="style-grid record-style-grid">${Object.entries(recordStyles).map(([value, style]) => `<button class="style-card" data-record-choice="${value}" aria-pressed="${state.recordStyle === value}"><span class="style-preview record-material-preview" data-record-style="${value}" aria-hidden="true"><span class="record-sample">${recordTexture(value)}<i class="sample-label" style="background-image:url('${escape(coverUrl(currentTrack()))}')"></i><i class="sample-spindle"></i></span><i class="record-sample-sheen"></i></span><strong>${style.name}</strong><small>${style.description}</small><span class="style-selected" aria-hidden="true">${icon('check')}</span></button>`).join('')}</div><div class="style-footer"><p class="record-style-saved style-saved" aria-live="polite"></p><button class="dialog-primary" data-action="settings-style">完成 ${icon('check')}</button></div>`, 'dark-settings style-settings record-style-settings');
  updateRecordSelection();
}
function updateRecordSelection() {
  $$('[data-record-choice]', dialog).forEach(el => el.setAttribute('aria-pressed', el.dataset.recordChoice === state.recordStyle));
  const saved = $('.record-style-saved', dialog);
  if (saved) saved.textContent = `${recordStyles[state.recordStyle].name}，已自动保存`;
}
function output(fromSettings = false) {
  showDialog('从文件，到你的耳朵', `${fromSettings ? settingsBack('settings-playback', '返回播放设置') : ''}<p class="dialog-description">${currentTrack().url ? '当前为浏览器音频输出；实际硬件格式未经检测。' : '以下为音频链路概念预览，并非当前硬件检测结果。'}</p><div class="signal-chain"><div>${icon('disc')}<span><strong>${currentTrack().url ? escape(currentTrack().format) : 'FLAC · 24 bit / 96 kHz'}</strong><small>${currentTrack().url ? '已导入的本地文件' : '本地音乐文件 · 示例'}</small></span><b>01</b></div><div>${icon('settings')}<span><strong>${currentTrack().url ? '浏览器解码' : '原生音频引擎'}</strong><small>${currentTrack().url ? '由当前浏览器支持的解码器处理' : '规划：按源采样率输出'}</small></span><b>02</b></div><div>${icon('usb')}<span><strong>USB DAC 独占输出</strong><small>概念展示 · 尚未接入</small></span><b>03</b></div></div><div class="output-note"><strong>USB 独占可以探索</strong><p>需要 Android 原生音频层、USB Host 及兼容 DAC。Android 14 的位完美模式仍依赖设备实现；内置 DAC 则需要单独适配。</p></div><a class="source-link" href="https://source.android.com/docs/core/audio/preferred-mixer-attr?hl=zh-cn" target="_blank" rel="noreferrer">查看 Android 官方说明 ↗</a>`, fromSettings ? 'dark-settings' : '');
}
function queue() { showDialog('接下来，想听什么', `<div class="queue-heading"><span>${queuedTracks().length} 首音乐</span><button data-action="mode">${icon(playbackModes[state.mode].icon)}${playbackModes[state.mode].name}</button></div><div class="queue-list">${queuedTracks().map(song => trackRow(song, tracks.indexOf(song))).join('')}</div><button class="dialog-secondary" data-action="import">${icon('import')} 导入本地音频试听</button><p class="dialog-caption">示例曲目为无声交互演示。导入文件只在当前浏览器中使用。</p>`); }
let appearancePanel = 'player';
function positionPlayerSheet() {
  if (!dialog.open || !dialog.classList.contains('player-appearance-sheet')) return;
  const screen = $(`[data-panel="${appearancePanel}"] .screen`);
  if (!screen) return;
  const rect = screen.getBoundingClientRect();
  const landscape = rect.width > rect.height;
  const sheetWidth = landscape ? Math.min(420, rect.width * .52) : rect.width;
  dialog.style.setProperty('--sheet-left', `${Math.max(0, landscape ? rect.right - sheetWidth : rect.left)}px`);
  dialog.style.setProperty('--sheet-width', `${Math.min(sheetWidth, innerWidth)}px`);
  dialog.style.setProperty('--sheet-bottom', `${Math.max(0, innerHeight - rect.bottom)}px`);
  dialog.style.setProperty('--sheet-height', `${Math.min(rect.height * (landscape ? .92 : .57), innerHeight * .92)}px`);
}
function playerAppearance(panel) {
  appearancePanel = panel;
  if (!state.device) $(`[data-panel="${panel}"] .screen`)?.scrollIntoView({ block: 'center', behavior: 'instant' });
  showDialog('播放外观', `<section class="sheet-section"><h3>播放画面</h3><div class="sheet-player-modes">${Object.entries(playbackStyles).map(([key, style]) => `<button data-player-art="${key}" aria-label="播放画面：${style.name}" aria-pressed="${state.art === key}"><span class="sheet-mode-preview mode-${key}">${key === 'vinyl' ? `<span class="record-sample">${recordTexture(state.recordStyle)}<i class="sample-label" style="background-image:url('${escape(coverUrl(currentTrack()))}')"></i></span>` : `<img src="${escape(coverUrl(currentTrack()))}" data-fallback="${albumFallback(currentTrack())}" alt=""/>`}</span><small>${style.name}</small></button>`).join('')}</div></section><div class="sheet-vinyl-options" ${state.art !== 'vinyl' ? 'hidden' : ''}><section class="sheet-section"><h3>唱片材质</h3><div class="sheet-records" role="group" aria-label="唱片材质">${Object.entries(recordStyles).map(([key, style]) => `<button data-record-choice="${key}" aria-label="${style.name}" aria-pressed="${state.recordStyle === key}"><span class="sheet-record-ring" data-record-style="${key}"><span class="record-sample">${recordTexture(key)}<i class="sample-label" style="background-image:url('${escape(coverUrl(currentTrack()))}')"></i></span></span><small>${style.name}</small></button>`).join('')}</div></section>
    <section class="sheet-section"><h3>唱臂</h3><div class="sheet-arms" role="group" aria-label="唱臂">${Object.entries(tonearmStyles).map(([key, style]) => `<button data-tonearm-choice="${key}" aria-pressed="${state.tonearmStyle === key}"><span class="sheet-arm-preview">${tonearmSprite(key)}</span><span>${style.name}</span></button>`).join('')}</div></section>
    <section class="sheet-section"><h3>唱头颜色</h3>${cartridgeColorOptions()}</section>
    <section class="sheet-section"><h3>唱头灯光</h3><div class="sheet-lights" role="group" aria-label="唱头灯光">${Object.entries(stylusLights).map(([key, light]) => `<button data-stylus-choice="${key}" aria-pressed="${state.stylusLight === key}"><i style="border-color:${light.color};background:${key === 'off' ? 'transparent' : light.color}"></i><span>${light.name}</span></button>`).join('')}</div></section>${recordSpeedSettings()}</div>`, 'player-appearance-sheet');
  const close = $('[data-action="close-dialog"]', dialog);
  close.innerHTML = icon('down'); close.setAttribute('aria-label', '收起播放外观');
  positionPlayerSheet();
  if (!reducedMotion.matches) dialog.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' });
}
function closeDialog() {
  if (!dialog.classList.contains('player-appearance-sheet') || reducedMotion.matches) { dialog.close(); return; }
  const from = getComputedStyle(dialog).transform;
  dialog.getAnimations().forEach(animation => animation.cancel());
  dialog.animate([{ transform: from }, { transform: 'translateY(100%)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' }).finished.then(() => {
    dialog.close(); dialog.getAnimations().forEach(animation => animation.cancel());
  }).catch(() => {});
}
dialog.addEventListener('cancel', event => { if (dialog.classList.contains('player-appearance-sheet')) { event.preventDefault(); closeDialog(); } });
dialog.addEventListener('close', () => { if (dialog.classList.contains('player-appearance-sheet')) $(`[data-panel="${appearancePanel}"] [data-action="open-player-appearance"]`)?.focus({ preventScroll: true }); });
window.addEventListener('resize', () => requestAnimationFrame(positionPlayerSheet));
function recordSpeedSettings() {
  return `<section class="record-speed-settings" aria-labelledby="record-speed-title"><h3 id="record-speed-title">黑胶转速</h3><p>仅调整唱片动画，歌曲按原速播放。选择后自动保存。</p><div class="record-speed-options" role="group" aria-label="黑胶转速">${Object.entries(recordSpeeds).map(([key, speed]) => `<button data-record-speed="${key}" aria-pressed="${state.recordSpeed === key}"><strong>${speed.name}</strong><small>${speed.note}</small></button>`).join('')}</div></section>`;
}
function cartridgeColorOptions() {
  return `<div class="cartridge-color-options" role="group" aria-label="唱头颜色">${Object.entries(cartridgeColors).map(([key, color]) => `<button data-cartridge-choice="${key}" aria-label="唱头颜色：${color.name}" aria-pressed="${state.cartridgeColor === key}"><span class="cartridge-color-ring"><i style="background:linear-gradient(135deg,${color.highlight},${color.color},${color.shadow});color:${['silver', 'gold', 'ice'].includes(key) ? '#20242a' : '#fff'}">${icon('check')}</i></span><small>${color.name}</small></button>`).join('')}</div>`;
}
function cartridgeColorSettings() {
  return `<section class="record-speed-settings"><h3>唱头颜色</h3>${cartridgeColorOptions()}</section>`;
}
function stylusLightSettings() {
  return `<section class="record-speed-settings"><h3>唱头灯光</h3><p>播放时在针尖亮起，暂停后渐隐。</p><div class="stylus-light-options" role="group" aria-label="唱头灯光">${Object.entries(stylusLights).map(([key, light]) => `<button data-stylus-choice="${key}" aria-pressed="${state.stylusLight === key}"><i style="--light-color:${light.color}" class="${key === 'off' ? 'light-off' : ''}" aria-hidden="true"></i><strong>${light.name}</strong></button>`).join('')}</div></section>`;
}
function tonearmStyleSettings() {
  return `<section class="record-speed-settings"><h3>唱臂风格</h3><p>与唱片材质自由搭配，选择后自动保存。</p><div class="tonearm-style-options" role="group" aria-label="唱臂风格">${Object.entries(tonearmStyles).map(([key, style]) => `<button data-tonearm-choice="${key}" aria-pressed="${state.tonearmStyle === key}"><span class="tonearm-style-preview">${tonearmSprite(key)}</span><strong>${style.name}</strong><small>${style.description}</small><span class="tonearm-selected" aria-hidden="true">${icon('check')}</span></button>`).join('')}</div></section>`;
}
function settingsBack(action = 'settings', label = '返回设置') {
  return `<button class="settings-back" data-action="${action}">${icon('back')}${label}</button>`;
}
function settingsRow(action, symbol, title, detail) {
  return `<button data-action="${action}">${symbol ? icon(symbol) : ""}<span><strong>${title}</strong><small>${detail}</small></span>${icon('forward')}</button>`;
}
function settingsToggle(action, title, note, enabled, disabled = false) {
  return `<button class="settings-toggle" data-action="${action}" role="switch" aria-checked="${enabled}" aria-label="${title}" ${disabled ? 'disabled' : ''}><span><strong>${title}</strong><small>${note}</small></span><i aria-hidden="true"></i></button>`;
}
function settingsGroup(title, rows) { return `<section class="settings-group"><h3>${title}</h3><div class="settings-list compact-settings">${rows}</div></section>`; }
function settings() {
  showDialog('设置', `<p class="settings-intro">让音乐，按你的习惯播放。</p>
    ${settingsGroup('曲库与外观', settingsRow('settings-storage', '', '文件扫描', '选择来源、过滤规则与扫描方式') + settingsRow('settings-style', '', '样式管理', '主页、播放画面与唱片细节'))}
    ${settingsGroup('常用设置', settingsToggle('sleep-toggle', '定时停止播放', state.sleepEnd ? sleepDescription() : '开启后默认 30 分钟', !!state.sleepEnd) + settingsRow('settings-sleep', '', '定时时长', '15 / 30 / 60 / 90 分钟') + settingsToggle('background-playback', '后台播放', '锁屏或离开应用后继续播放', state.backgroundPlayback) + settingsRow('settings-effects', '', '均衡器', 'iOS 开发版已接入') + settingsRow('settings-peq', '', 'PEQ', '未接入'))}
    ${settingsGroup('播放与系统', settingsRow('settings-playback', '', '高级设置', '播放方式、歌词、过渡与回放增益') + settingsRow('settings-usb', '', 'USB 输出', '系统输出') + settingsRow('settings-language', '', '语言设置', '简体中文') + settingsRow('settings-about', '', '关于 Sovel HiFi', '0.1.0 · 开发预览'))}`, 'dark-settings settings-root');
}
function sleepSettings() {
  showDialog('定时停止播放', `${settingsBack()}${settingsToggle('sleep-toggle', '定时停止播放', '到时暂停，不改变播放队列', !!state.sleepEnd)}<section class="record-speed-settings sleep-settings"><p data-sleep-status aria-live="polite">${sleepDescription()}</p><div class="record-speed-options">${[0, 15, 30, 60, 90].map(minutes => `<button data-sleep-minutes="${minutes}" aria-pressed="${state.sleepMinutes === minutes}"><strong>${minutes ? minutes + ' 分钟' : '关闭'}</strong></button>`).join('')}</div></section><p class="dialog-caption">网页定时在浏览器挂起页面时可能延后执行。</p>`, 'dark-settings');
}
function settingsInfo(kind) {
  const row = (title, note, status = '') => `<div class="capability-row"><span><strong>${title}</strong><small>${note}</small></span><b>${status}</b></div>`;
  const contents = {
    effects: ['均衡器', row('十段均衡器', '31 Hz–16 kHz · 每段 ±12 dB', '移动端') + row('听感预设', '平直、人声、流行、摇滚、古典、低频增强') + row('我的预设', '保存、恢复与删除，重启后记忆设置') + row('前级增益', '支持自动留出余量，减少削波') + '<p class="dialog-caption">iOS 开发版已接入实际音频处理，请在应用的「设置 → 均衡器」体验。Android 端正在验证，网页预览不应用 EQ。</p>'],
    peq: ['参数均衡器 · PEQ', settingsToggle('', '参数均衡器 · PEQ', '音频处理模块未接入', false, true)],
    usb: ['USB 输出', row('系统音频输出', '由设备系统选择当前输出设备', '使用中') + row('USB 独占', 'Android 专用输出模块尚未接入', '不可用') + row('DSD 直通 / DoP', '需要专用模块及兼容的 DAC', '不可用') + '<p class="dialog-caption">浏览器无法提供 USB 音频独占。连接 DAC 不代表已获得独占或 Bit-perfect 输出。</p>'],
    language: ['语言设置', row('简体中文', '其他语言将在完整翻译后提供', '当前语言')],
    about: ['关于 Sovel HiFi', '<p class="settings-brand">Sovel</p><p class="settings-intro">收藏声音，慢慢聆听。</p>' + row('版本', '网页交互预览', '0.1.0') + row('移动端曲库', 'SQLite 本地索引，引用原音频文件')],
  };
  const [title, content] = contents[kind]; showDialog(title, settingsBack() + content, 'dark-settings');
}
function styleSettings() {
  showDialog('样式管理', `${settingsBack()}<div class="settings-list">${settingsRow('home-appearance', 'palette', '主页布局', themes[state.theme].name)}${settingsRow('record-appearance', 'disc', '唱片样式', recordStyles[state.recordStyle].name)}</div>${tonearmStyleSettings()}${cartridgeColorSettings()}${recordSpeedSettings()}${stylusLightSettings()}`, 'dark-settings');
}
function sleepDescription() {
  return state.sleepEnd ? `约 ${Math.max(1, Math.ceil((state.sleepEnd - Date.now()) / 60000))} 分钟后暂停 · ${new Date(state.sleepEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 结束` : '到时自动暂停，切歌不影响计时。';
}
function updateSleepSettings() {
  $$('[data-sleep-status]').forEach(el => { const label = sleepDescription(); if (el.textContent !== label) el.textContent = label; });
  $$('[data-action="sleep-toggle"]').forEach(el => el.setAttribute('aria-checked', !!state.sleepEnd));
  $$('[data-sleep-minutes]').forEach(el => el.setAttribute('aria-pressed', Number(el.dataset.sleepMinutes) === state.sleepMinutes));
}
function setPlaybackMode(mode) {
  state.mode = mode; save(); updatePlaybackUI();
  $$('[data-mode-choice]').forEach(el => el.setAttribute('aria-pressed', el.dataset.modeChoice === mode));
}
function playbackSettings() {
  showDialog('高级设置', `${settingsBack()}
    <section class="record-speed-settings"><h3>播放方式</h3><div class="record-speed-options" role="group" aria-label="播放方式">${Object.entries(playbackModes).map(([key, mode]) => `<button data-mode-choice="${key}" aria-pressed="${state.mode === key}">${icon(mode.icon)}<strong>${mode.name}</strong></button>`).join('')}</div></section>
    <section class="record-speed-settings lyric-size-settings"><h3>歌词字号</h3><p>调整完整歌词页面的文字大小。</p><div class="record-speed-options" role="group" aria-label="歌词字号">${[['standard', '标准', '均衡显示'], ['large', '大字', '更轻松阅读']].map(([key, name, note]) => `<button data-lyric-size="${key}" aria-pressed="${Boolean(state.lyricSize) === (key === 'large')}"><strong>${name}</strong><small>${note}</small></button>`).join('')}</div></section>
    <section class="settings-group"><h3>音频行为 · 移动端当前能力</h3><div class="capability-row"><span><strong>耳机拔出暂停</strong><small>由系统音频层管理</small></span><b>已开启</b></div><div class="capability-row"><span><strong>歌曲过渡</strong><small>淡入淡出、无缝播放待适配</small></span><b>普通切歌</b></div><div class="capability-row"><span><strong>回放增益</strong><small>标签与音频处理链尚未接入</small></span><b>未接入</b></div><div class="capability-row"><span><strong>DSD 模式</strong><small>目前可读取 DSF / DFF 标签</small></span><b>仅索引</b></div></section>`, 'dark-settings playback-settings');
}
const selectedMusicFiles = new Map();
let webScan = null;
let webScanResult = null;
const audioFilePattern = /\.(flac|wav|wave|dsf|dff|aif|aiff|m4a|alac|ape|wv|mp3|aac|ogg|opus)$/i;
function storageSettings(keepScroll = false) {
  const scroll = dialog.scrollTop;
  const rules = state.scanRules;
  const locked = webScan?.running;
  showDialog('文件扫描', `${settingsBack()}<p class="scan-intro">把你的音乐，留在原来的位置。</p><p class="dialog-caption scan-note">先扫描全部来源，确定总数，再显示导入进度。音频不会上传或额外复制。</p>
    <section class="scan-source"><h3>音乐来源 <small>· ${selectedMusicFiles.size} 个待扫描文件</small></h3><div class="scan-actions"><button data-action="scan-folder" ${locked ? 'disabled' : ''}>添加文件夹</button><button data-action="scan-files" ${locked ? 'disabled' : ''}>选择文件</button></div><p class="scan-note">浏览器只保留本次会话的文件授权。</p></section>
    ${settingsGroup('扫描规则', settingsToggle('scan-small', '过滤小文件', '跳过低于指定大小的音频', rules.filterSmall, locked) + (rules.filterSmall ? `<label class="scan-threshold">小于 <input aria-label="最小文件大小 KB" id="scan-min-size" type="number" min="1" max="1048576" value="${rules.minSizeKB}" ${locked ? 'disabled' : ''}> KB 的文件</label>` : '') + settingsToggle('scan-hidden', '忽略隐藏文件与文件夹', '跳过名称以点号开头的内容', rules.ignoreHidden, locked) + settingsToggle('scan-subfolders', '包含子文件夹', '一并扫描专辑等下级目录', rules.includeSubfolders, locked))}
    <p class="scan-note">规则只影响本次扫描范围，已入库但被过滤的歌曲会保留。</p><div class="scan-actions scan-start"><button data-action="scan-incremental" ${locked || !selectedMusicFiles.size ? 'disabled' : ''}><strong>增量扫描</strong><small>只读取新增或变化的音乐</small></button><button data-action="scan-full" ${locked || !selectedMusicFiles.size ? 'disabled' : ''}><strong>全量扫描</strong><small>重新索引已选择的音乐</small></button></div>
    <p class="scan-note">两种扫描均保留收藏。移动端全量扫描会重新读取标签、封面与歌词，不清空数据库。</p><div id="web-scan-status" role="status" aria-live="polite">${webScanStatus()}</div>
    <details class="scan-more"><summary>更多导入方式</summary><p class="dialog-caption">移动端支持持久文件夹授权、原创试听与可选的应用内副本；远程 SMB / WebDAV / DLNA / OpenSubsonic 后续接入。</p></details><p class="dialog-caption">网页仅预览文件索引；内嵌标签和封面的完整读取请在移动端体验。</p>`, 'dark-settings scan-settings');
  if (keepScroll) dialog.scrollTop = scroll;
}
function webScanStatus() {
  if (webScan?.running) return `<div class="scan-result"><strong>${webScan.phase === 'discovering' ? '1 / 2 · 扫描音乐文件' : '2 / 2 · 导入曲库'}</strong><p>${webScan.total === null ? `已发现 ${webScan.done} 个音频文件` : `已处理 ${webScan.done} / ${webScan.total} 首音乐`} · ${escape(webScan.path)}</p>${webScan.total === null ? '' : `<progress value="${webScan.done}" max="${webScan.total || 1}"></progress>`}<button class="settings-back" data-action="scan-cancel">取消扫描</button></div>`;
  if (webScan?.cancelled) return '<div class="scan-result">扫描已取消，本次变更未提交。</div>';
  if (!webScanResult) return '';
  return `<div class="scan-result"><strong>最近扫描结果</strong><p>${new Date(webScanResult.at).toLocaleString()}</p><div class="scan-metrics">${[['新增',webScanResult.added],['更新',webScanResult.updated],['未变化',webScanResult.unchanged]].map(([name, number]) => `<span><b>${number}</b>${name}</span>`).join('')}</div><p>已过滤 ${webScanResult.filtered} 个文件</p></div>`;
}
async function scanWebFiles(mode) {
  if (webScan?.running || !selectedMusicFiles.size) return;
  const rules = { ...state.scanRules };
  const files = [...selectedMusicFiles];
  const changes = [];
  const candidates = [];
  const result = { added: 0, updated: 0, unchanged: 0, filtered: 0, at: Date.now() };
  webScan = { running: true, cancelled: false, phase: 'discovering', done: 0, total: null, path: '' };
  storageSettings(true);
  for (const [key, file] of files) {
    if (webScan.cancelled) break;
    const parts = key.split('/');
    // The directory picker includes the selected root name; scan scope starts below it.
    const relative = file.webkitRelativePath ? parts.slice(1) : parts;
    if ((rules.filterSmall && file.size < rules.minSizeKB * 1024) || (rules.ignoreHidden && relative.some(p => p.startsWith('.'))) || (!rules.includeSubfolders && relative.length > 1)) result.filtered++;
    else candidates.push([key, file]);
    webScan.done++; webScan.path = key;
    const status = $('#web-scan-status'); if (status) status.innerHTML = webScanStatus();
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  webScan.phase = 'importing'; webScan.done = 0; webScan.total = candidates.length;
  for (const [key, file] of candidates) {
    if (webScan.cancelled) break;
    const status = $('#web-scan-status'); if (status) status.innerHTML = webScanStatus();
    await new Promise(resolve => setTimeout(resolve, 0));
    if (webScan.cancelled) break;
    const previous = tracks.find(t => t.importKey === key);
    if (mode === 'incremental' && previous && previous.size === file.size && previous.mtime === file.lastModified) result.unchanged++;
    else { changes.push({ key, file, previous }); previous ? result.updated++ : result.added++; }
    webScan.done++; webScan.path = key;
  }
  if (!webScan.cancelled) {
    for (const { key, file, previous } of changes) {
      const metadata = { importKey: key, title: file.name.replace(/\.[^.]+$/, ''), artist: '本地音乐', album: '导入的音乐', english: 'YOUR LOCAL COLLECTION', image: 'ocean', duration: 1, format: file.name.split('.').pop().toUpperCase(), detail: '本地文件', color: '#8d7365', url: URL.createObjectURL(file), fileName: file.name, size: file.size, mtime: file.lastModified, lines: null };
      if (previous) { const oldUrl = previous.url; const playing = currentTrack() === previous; Object.assign(previous, metadata); if (playing) { audio.pause(); state.playing = false; audio.src = previous.url; state.position = 0; } if (oldUrl) URL.revokeObjectURL(oldUrl); }
      else tracks.push({ id: `local-${Date.now()}-${tracks.length}`, ...metadata });
    }
    webScanResult = result; render();
  }
  webScan.running = false;
  if (dialog.open && $('#web-scan-status')) storageSettings(true);
}
function search() { showDialog('找到想听的声音', `<form id="search-form"><label class="search-input">${icon('search')}<input name="query" type="search" placeholder="搜索歌曲、专辑或艺术家" value="${escape(state.query)}" autocomplete="off" autofocus/></label><button class="dialog-primary" type="submit">搜索音乐 ${icon('arrow')}</button></form><p class="dialog-caption">试试「陈屿」「雪线」或「给远方的信」</p>`); }
document.addEventListener('click', async event => {
  const el = event.target.closest('button');
  if (!el) return;
  const panel = el.closest('[data-panel]')?.dataset.panel || state.focus;
  if (el.dataset.contextAlbum) { contextCollection = { kind: 'album', key: el.dataset.contextAlbum, from: el.dataset.albumFrom }; render(); return; }
  if (el.dataset.contextCollection) { contextCollection = el.dataset.contextCollection === 'all' ? null : el.dataset.contextCollection === 'artist' ? { kind: 'artist' } : { kind: 'album', key: contextAlbumKey(currentTrack()), from: 'details' }; render(); return; }
  if (el.dataset.playerArt && Object.hasOwn(playbackStyles, el.dataset.playerArt)) { state.art = el.dataset.playerArt; save(); render(); $$('[data-player-art]', dialog).forEach(option => option.setAttribute('aria-pressed', option.dataset.playerArt === state.art)); $('.sheet-vinyl-options', dialog).hidden = state.art !== 'vinyl'; return; }
  if (el.dataset.modeChoice && Object.hasOwn(playbackModes, el.dataset.modeChoice)) {
    setPlaybackMode(el.dataset.modeChoice); return;
  }
  if (el.dataset.sleepMinutes !== undefined) {
    state.sleepMinutes = Number(el.dataset.sleepMinutes);
    state.sleepEnd = state.sleepMinutes ? Date.now() + state.sleepMinutes * 60000 : null;
    updateSleepSettings(); return;
  }
  if (['standard', 'large'].includes(el.dataset.lyricSize)) {
    state.lyricSize = el.dataset.lyricSize === 'large' ? 1 : 0;
    save(); render();
    $$('[data-lyric-size]', dialog).forEach(option => option.setAttribute('aria-pressed', Boolean(state.lyricSize) === (option.dataset.lyricSize === 'large')));
    toast('歌词字号已保存');
    return;
  }
  if (el.dataset.recordSpeed && Object.hasOwn(recordSpeeds, el.dataset.recordSpeed)) {
    turntableTime();
    state.recordSpeed = el.dataset.recordSpeed;
    save(); render();
    $$('[data-record-speed]', dialog).forEach(option => option.setAttribute('aria-pressed', option.dataset.recordSpeed === state.recordSpeed));
    toast(`黑胶转速：${recordSpeeds[state.recordSpeed].name} · 已保存`);
    return;
  }
  if (el.dataset.cartridgeChoice && Object.hasOwn(cartridgeColors, el.dataset.cartridgeChoice)) {
    state.cartridgeColor = el.dataset.cartridgeChoice;
    save(); render();
    $$('[data-cartridge-choice]', dialog).forEach(option => option.setAttribute('aria-pressed', option.dataset.cartridgeChoice === state.cartridgeColor));
    $$('[data-tonearm-sprite]', dialog).forEach(sprite => { sprite.innerHTML = tonearmLayers(sprite.dataset.tonearmSprite); });
    if (!dialog.classList.contains('player-appearance-sheet')) toast(`唱头颜色：${cartridgeColors[state.cartridgeColor].name} · 已保存`);
    return;
  }
  if (el.dataset.stylusChoice && Object.hasOwn(stylusLights, el.dataset.stylusChoice)) {
    state.stylusLight = el.dataset.stylusChoice;
    save(); render();
    $$('[data-stylus-choice]', dialog).forEach(option => option.setAttribute('aria-pressed', option.dataset.stylusChoice === state.stylusLight));
    if (!dialog.classList.contains('player-appearance-sheet')) toast(`唱头灯光：${stylusLights[state.stylusLight].name} · 已保存`);
    return;
  }
  if (el.dataset.tonearmChoice && Object.hasOwn(tonearmStyles, el.dataset.tonearmChoice)) {
    state.tonearmStyle = el.dataset.tonearmChoice;
    save(); render();
    $$('[data-tonearm-choice]', dialog).forEach(option => option.setAttribute('aria-pressed', option.dataset.tonearmChoice === state.tonearmStyle));
    if (!dialog.classList.contains('player-appearance-sheet')) toast(`唱臂风格：${tonearmStyles[state.tonearmStyle].name} · 已保存`);
    return;
  }
  if (el.dataset.recordChoice && recordStyles[el.dataset.recordChoice]) { state.recordStyle = el.dataset.recordChoice; save(); render(); updateRecordSelection(); return; }
  if (el.dataset.homeStyle && themes[el.dataset.homeStyle]) { setTheme(el.dataset.homeStyle); updateStyleSelection(); return; }
  if (el.dataset.theme && themes[el.dataset.theme]) { setTheme(el.dataset.theme); return; }
  if (el.dataset.orientation) { state.orientation = el.dataset.orientation; if (state.orientation === 'landscape') state.view = 'focus'; render(); return; }
  if (el.dataset.focus) { state.focus = el.dataset.focus; state.pages[state.focus] = state.focus; render(); return; }
  if (el.dataset.track !== undefined) { if (!el.closest('.queue-list')) state.queueIds = el.closest('.library-page') && state.discoveryMix ? [...state.discoveryMix.ids] : null; contextCollection = null; await selectTrack(Number(el.dataset.track), true); dialog.close(); if (!el.closest('.queue-list')) navigate('player', panel); return; }
  if (el.dataset.folder) { state.query = el.dataset.folder; state.libraryTab = 'tracks'; dialog.close(); render(); return; }
  if (el.dataset.libraryAlbum) { state.collectionFilter = el.dataset.libraryAlbum; state.libraryTab = 'tracks'; render(); return; }
  if (el.dataset.artist) { state.collectionFilter = ''; state.query = el.dataset.artist; state.libraryTab = 'tracks'; render(); return; }
  if (el.dataset.lyric !== undefined) { seek(lyricTime(Number(el.dataset.lyric))); return; }
  const action = el.dataset.action;
  if (action?.startsWith('navigate-')) { navigate(action.slice(9), panel); return; }
  if (action?.startsWith('tab-')) { state.discoveryMix = null; state.libraryTab = action.slice(4); state.collectionFilter = ''; state.query = ''; render(); return; }
  if (action?.startsWith('filter-')) { state.discoveryMix = null; state.filter = action.slice(7); state.query = ''; state.collectionFilter = ''; render(); return; }
  if (action?.startsWith('discovery-')) {
    const kind = action.slice(10);
    if (kind === 'resume') { if (!state.playing) await playPause(); navigate('player', panel); return; }
    state.query = ''; state.collectionFilter = ''; state.filter = kind === 'favorites' ? 'favorites' : 'all';
    state.libraryTab = 'tracks';
    state.discoveryMix = kind === 'daily' || kind === 'related'
      ? { title: kind === 'daily' ? '每日精选' : '猜你喜欢', ids: localDiscovery()[kind].map(t => t.id) } : null;
    render(); return;
  }
  switch (action) {
    case 'collection-layout': { const key = state.libraryTab === 'artists' ? 'artistLayout' : 'albumLayout'; state[key] = state[key] === 'cards' ? 'list' : 'cards'; save(); render(); break; }
    case 'play': await playPause(); break;
    case 'next': nextTrack(); break;
    case 'previous': nextTrack(-1); break;
    case 'favorite': { const id = currentTrack().id; state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id); save(); render(); break; }
    case 'mode': { const modes = Object.keys(playbackModes); setPlaybackMode(modes[(modes.indexOf(state.mode) + 1) % modes.length]); if (dialog.open) queue(); toast(playbackModes[state.mode].name); break; }
    case 'background-playback': state.backgroundPlayback = !state.backgroundPlayback; save(); el.setAttribute('aria-checked', state.backgroundPlayback); break;
    case 'lyric-size': state.lyricSize = state.lyricSize ? 0 : 1; save(); render(); toast(state.lyricSize ? '大字歌词' : '标准字号'); break;
    case 'settings-style': styleSettings(); break;
    case 'settings-playback': playbackSettings(); break;
    case 'settings-storage': storageSettings(); break;
    case 'settings-sleep': sleepSettings(); break;
    case 'sleep-toggle': state.sleepMinutes = state.sleepEnd ? 0 : 30; state.sleepEnd = state.sleepMinutes ? Date.now() + state.sleepMinutes * 60000 : null; if ($('#dialog-title').textContent === '设置') settings(); else sleepSettings(); break;
    case 'settings-effects': settingsInfo('effects'); break;
    case 'settings-peq': settingsInfo('peq'); break;
    case 'settings-usb': settingsInfo('usb'); break;
    case 'settings-language': settingsInfo('language'); break;
    case 'settings-about': settingsInfo('about'); break;
    case 'scan-small': if (!webScan?.running) { state.scanRules.filterSmall = !state.scanRules.filterSmall; save(); storageSettings(true); } break;
    case 'scan-hidden': if (!webScan?.running) { state.scanRules.ignoreHidden = !state.scanRules.ignoreHidden; save(); storageSettings(true); } break;
    case 'scan-subfolders': if (!webScan?.running) { state.scanRules.includeSubfolders = !state.scanRules.includeSubfolders; save(); storageSettings(true); } break;
    case 'scan-files': if (!webScan?.running) $('#audio-import').click(); break;
    case 'scan-folder': if (!webScan?.running) $('#folder-import').click(); break;
    case 'scan-incremental': await scanWebFiles('incremental'); break;
    case 'scan-full': await scanWebFiles('full'); break;
    case 'scan-cancel': if (webScan?.running) webScan.cancelled = true; break;
    case 'settings-output': output(true); break;
    case 'home-appearance': homeAppearance(); break;
    case 'record-appearance': recordAppearance(); break;
    case 'open-player-appearance': playerAppearance(panel); break;
    case 'song-file-info': { const song = currentTrack(); showDialog('音频文件信息', `<div class="context-file-info"><h3>${escape(song.title)}</h3><p>${escape(song.artist)} · ${escape(song.album)}</p><p>${escape(song.format)} · ${time(song.duration)}</p><p>${song.url ? '浏览器导入文件，尚未解析音频标签。' : '示例曲目 · 参数用于页面演示。'}</p></div>`, 'dark-settings'); break; }
    case 'output': output(); break;
    case 'queue': queue(); break;
    case 'folders': showDialog('音乐文件夹', `<p class="dialog-description">示例目录按专辑组织。正式版可接入设备存储与 SD 卡扫描。</p><div class="settings-list">${[...new Set(tracks.map(t => t.album))].map(album => `<button data-folder="${escape(album)}">${icon('folder')}<span><strong>${escape(album)}</strong><small>${tracks.filter(t => t.album === album).length} 首音乐 · 演示目录</small></span>${icon('forward')}</button>`).join('')}</div><button class="dialog-secondary" data-action="import">导入本地文件</button>`); break;
    case 'settings': case 'more': settings(); break;
    case 'import': storageSettings(); if (!webScan?.running) $('#audio-import').click(); break;
    case 'close-dialog': closeDialog(); break;
    case 'search': state.searchPanel = panel; search(); break;
    case 'clear-search': state.query = ''; render(); break;
  }
});
$('#view-toggle').addEventListener('click', () => { state.view = state.view === 'focus' ? 'overview' : 'focus'; if (state.view === 'overview') state.orientation = 'portrait'; state.pages = { library: 'library', player: 'player', lyrics: 'lyrics' }; render(); });
$('#choose-direction').addEventListener('click', settings);
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog(); } });
document.addEventListener('submit', event => { if (event.target.id === 'search-form') { event.preventDefault(); state.query = new FormData(event.target).get('query').trim(); state.libraryTab = 'tracks'; state.filter = 'all'; dialog.close(); navigate('library', state.searchPanel || 'library'); } });
document.addEventListener('input', event => { if (event.target.matches('[data-progress]')) seek(Number(event.target.value)); });
document.addEventListener('change', event => {
  if (event.target.id === 'scan-min-size' && !webScan?.running) { state.scanRules.minSizeKB = Math.min(1048576, Math.max(1, Math.round(Number(event.target.value) || 100))); event.target.value = state.scanRules.minSizeKB; save(); }
});
for (const id of ['audio-import', 'folder-import']) $(`#${id}`).addEventListener('change', event => {
  if (!webScan?.running) {
    let added = 0;
    for (const file of event.target.files) if (audioFilePattern.test(file.name)) { selectedMusicFiles.set(file.webkitRelativePath || file.name, file); added++; }
    storageSettings(true);
    if (added) toast(`已选择 ${added} 个文件，请选择扫描方式`);
    else if (event.target.files.length) toast('没有选中支持的音频文件');
  }
  event.target.value = '';
});
audio.addEventListener('loadedmetadata', () => { if (currentTrack().url && Number.isFinite(audio.duration)) { currentTrack().duration = audio.duration; render(); } });
audio.addEventListener('timeupdate', () => { if (currentTrack().url) { state.position = audio.currentTime; updatePlaybackUI(); } });
function finishTrack() { if (state.mode === 'single') selectTrack(state.current, true); else nextTrack(); }
audio.addEventListener('ended', () => { state.playing = true; finishTrack(); });
audio.addEventListener('error', () => { if (currentTrack().url) { state.playing = false; updatePlaybackUI(); toast('此文件暂时无法解码，请换一个浏览器支持的音频文件'); } });
document.addEventListener('keydown', event => {
  if (dialog.open || /INPUT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) return;
  if (event.code === 'Space') { event.preventDefault(); playPause(); }
  if (event.code === 'ArrowRight') seek(state.position + 5);
  if (event.code === 'ArrowLeft') seek(state.position - 5);
});

// Physical order: song details, playback, lyrics. Headers stay anchored while bodies slide.
// Sliders keep their own horizontal gesture, and vertical lyric scrolling stays native.

let swipe = null;
let suppressSwipeClick = false;
function clearSwipe() {
  if (!swipe) return;
  cancelAnimationFrame(swipe.frame);
  swipe.source.style.transform = '';
  swipe.source.classList.remove('swiping');
  if (swipe.preview) $$('.tonearm', swipe.preview).forEach(arm => arm.getAnimations().forEach(animation => animation.cancel()));
  swipe.preview?.remove();
  swipe = null;
}
function drawSwipe(gesture) {
  if (reducedMotion.matches) return;
  gesture.source.style.transform = `translateX(${gesture.x}px)`;
  if (gesture.preview) gesture.preview.style.transform = `translateX(${gesture.x - gesture.direction * gesture.width}px)`;
}
function settleSwipe(gesture, commit, velocity = 0) {
  gesture.pointer = null;
  const target = commit ? gesture.direction * gesture.width : 0;
  const complete = () => {
    const { page, panel } = gesture;
    clearSwipe();
    if (commit) navigate(page, panel);
  };
  if (reducedMotion.matches) { complete(); return; }
  let previous = performance.now();
  gesture.velocity = velocity;
  const step = now => {
    if (swipe !== gesture) return;
    const dt = Math.min((now - previous) / 1000, 1 / 30);
    previous = now;
    gesture.velocity += (420 * (target - gesture.x) - 41 * gesture.velocity) * dt;
    gesture.x += gesture.velocity * dt;
    drawSwipe(gesture);
    if (Math.abs(target - gesture.x) < .5 && Math.abs(gesture.velocity) < 4) complete();
    else gesture.frame = requestAnimationFrame(step);
  };
  gesture.frame = requestAnimationFrame(step);
}
$('#gallery').addEventListener('pointerdown', event => {
  suppressSwipeClick = false;
  if (!event.isPrimary || event.button !== 0 || dialog.open) return;
  if (event.target.closest('input, a, button:not(.lyric-line):not(.player-lyric-preview)')) return;
  const source = event.target.closest('.player-page, .lyrics-page, .song-context-page');
  if (!source) return;
  if (swipe && swipe.source !== source) clearSwipe();
  const previous = swipe;
  if (previous) cancelAnimationFrame(previous.frame);
  const screen = source.closest('.screen');
  const currentPage = source.classList.contains('player-page') ? 'player' : source.classList.contains('lyrics-page') ? 'lyrics' : 'about';
  const direction = previous?.direction || 0;
  swipe = {
    source, screen, direction, width: screen.clientWidth,
    currentPage, page: previous?.page || null,
    panel: source.closest('[data-panel]').dataset.panel,
    pointer: event.pointerId, startX: event.clientX, startY: event.clientY,
    x: previous?.x || 0, baseX: previous?.x || 0,
    preview: previous?.preview, locked: !!previous?.preview,
    points: [{ x: event.clientX, time: event.timeStamp }],
  };
});
$('#gallery').addEventListener('pointermove', event => {
  const gesture = swipe;
  if (!gesture || gesture.pointer !== event.pointerId) return;
  const dx = event.clientX - gesture.startX;
  const dy = event.clientY - gesture.startY;
  if (!gesture.locked) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { clearSwipe(); return; }
    if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    gesture.locked = true;
    gesture.screen.setPointerCapture(event.pointerId);
    gesture.source.classList.add('swiping');
    gesture.direction = dx > 0 ? 1 : -1;
    gesture.page = playerPages[playerPages.indexOf(gesture.currentPage) - gesture.direction];
    if (gesture.page) {
    const holder = document.createElement('div');
    holder.innerHTML = pageFunctions[gesture.page]();
    gesture.preview = holder.firstElementChild;
    gesture.preview.inert = true;
    gesture.preview.classList.add('swipe-preview');
    gesture.preview.style.top = '0';
    gesture.source.parentElement.append(gesture.preview);
    updatePlaybackUI(true);
    }
  }
  event.preventDefault();
  const position = gesture.baseX + dx;
  const forwards = position * gesture.direction;
  // Progressive resistance when dragging away from the available page.
  gesture.x = !gesture.page || forwards < 0 ? gesture.direction * forwards / (1 + Math.abs(forwards) / 35) : position;
  gesture.points.push({ x: event.clientX, time: event.timeStamp });
  gesture.points = gesture.points.filter(point => event.timeStamp - point.time < 100);
  drawSwipe(gesture);
});
function endSwipe(event, cancelled = false) {
  const gesture = swipe;
  if (!gesture || gesture.pointer !== event.pointerId) return;
  if (!gesture.locked) { clearSwipe(); return; }
  if (gesture.screen.hasPointerCapture(event.pointerId)) gesture.screen.releasePointerCapture(event.pointerId);
  suppressSwipeClick = true;
  const first = gesture.points[0];
  const elapsed = event.timeStamp - first.time;
  const velocity = elapsed > 0 && elapsed < 160 ? (event.clientX - first.x) / elapsed * 1000 : 0;
  const distance = gesture.x * gesture.direction;
  const projected = (gesture.x + velocity * .16) * gesture.direction;
  const commit = !cancelled && !!gesture.page && distance > 22 && projected > gesture.width * .24;
  settleSwipe(gesture, commit, cancelled ? 0 : velocity);
}
$('#gallery').addEventListener('pointerup', event => endSwipe(event));
$('#gallery').addEventListener('pointercancel', event => endSwipe(event, true));
$('#gallery').addEventListener('dragstart', event => {
  if (event.target.closest('.player-page, .lyrics-page, .song-context-page')) event.preventDefault();
});
document.addEventListener('click', event => {
  if (!suppressSwipeClick) return;
  suppressSwipeClick = false;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);
setInterval(() => {
  if (state.sleepEnd && Date.now() >= state.sleepEnd) { state.sleepEnd = null; state.sleepMinutes = 0; if (state.playing) playPause(); toast('睡眠定时已结束，音乐已暂停'); }
  updateSleepSettings();
  if (!state.playing || currentTrack().url) return;
  state.position += 1;
  if (state.position >= currentTrack().duration) finishTrack(); else updatePlaybackUI();
}, 1000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !state.backgroundPlayback && state.playing) playPause();
  if (!document.hidden) updateTonearms();
});
$('#gallery').addEventListener('error', event => {
  const image = event.target;
  if (image instanceof HTMLImageElement && image.dataset.fallback) {
    const fallback = image.dataset.fallback;
    delete image.dataset.fallback;
    image.src = fallback;
  }
}, true);
render();
matchMedia('(orientation: landscape)').addEventListener('change', event => {
  if (!state.device) return;
  state.orientation = event.matches ? 'landscape' : 'portrait';
  render();
});
// Direct preview links keep the settings flow easy to review on small screens.
if (params.get('settings') === 'scan') storageSettings();
else if (params.get('settings') === 'root') settings();
