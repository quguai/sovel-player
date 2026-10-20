import { zh, labels } from './copy.js';
import { loadGitHub, releaseView, repositoryUrl } from './github.js';

const preview = document.querySelector('#record-preview');
const playButton = document.querySelector('#record-play');
const record = document.querySelector('.record-spin');
const materialName = document.querySelector('#material-name');
const texture = document.querySelector('#record-texture');
const screen = document.querySelector('#app-screen');
const tabs = [...document.querySelectorAll('[data-screen]')];
const swatches = [...document.querySelectorAll('.material-swatch')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const compact = matchMedia('(max-width: 620px)');
const localized = [...document.querySelectorAll('[data-i18n], [data-i18n-html]')].map(element => ({
  element,
  key: element.dataset.i18n ?? element.dataset.i18nHtml,
  html: element.hasAttribute('data-i18n-html'),
  english: element.hasAttribute('data-i18n-html') ? element.innerHTML : element.textContent,
}));
const paths = { black: './assets/record-black.png', smoke: './assets/record-smoke.png', blue: './assets/record-blue.png' };

function readPreference(key) {
  try { return localStorage.getItem(`sovel-site-${key}`); } catch { return null; }
}
function savePreference(key, value) {
  try { localStorage.setItem(`sovel-site-${key}`, value); } catch { /* Browsing without storage still works. */ }
}
const requested = new URLSearchParams(location.search).get('lang');
let language = (requested ?? readPreference('language')) === 'zh' ? 'zh' : 'en';
let selectedScreen = 'library';
let selectedVinyl = 'player';
let github = { stars: null, release: undefined, error: false };
let playing = !reducedMotion.matches;
let visible = true;
let material = 'smoke';
let materialRevision = 0;
let loadingMaterial = false;
let materialError = false;

function refreshAnimation() {
  preview.dataset.playing = String(playing);
  record.style.animationPlayState = playing && visible && !document.hidden && !reducedMotion.matches ? 'running' : 'paused';
  playButton.disabled = reducedMotion.matches;
  playButton.setAttribute('aria-pressed', String(playing));
  const label = reducedMotion.matches ? 'reduced' : playing ? 'pause' : 'play';
  playButton.setAttribute('aria-label', labels[language][label]);
  playButton.title = labels[language][label];
}
function updateMaterialCaption() {
  materialName.textContent = labels[language][loadingMaterial ? 'loading' : materialError ? 'loadError' : material];
}
function refreshLabels() {
  const copy = labels[language];
  preview.setAttribute('aria-label', copy.preview);
  document.querySelector('.material-options').setAttribute('aria-label', copy.material);
  document.querySelector('.experience-tabs').setAttribute('aria-label', copy.tabs);
  swatches.forEach(button => button.setAttribute('aria-label', copy[button.dataset.material]));
  screen.alt = copy[`${selectedScreen === 'player' ? selectedVinyl : selectedScreen}Alt`];
  document.querySelectorAll('[data-vinyl]').forEach(button => button.setAttribute('aria-label', copy[button.dataset.vinyl === 'player' ? 'smoke' : button.dataset.vinyl]));
  refreshGitHub();
  updateMaterialCaption();
  refreshAnimation();
}
function setLanguage(value, remember = false) {
  language = value;
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  localized.forEach(({ element, key, html, english }) => {
    const value = language === 'zh' ? zh[key] : english;
    // HTML translations are fixed local strings containing only editorial markup.
    if (html) element.innerHTML = value;
    else element.textContent = value;
  });
  document.title = labels[language].title;
  document.querySelector('meta[name="description"]').content = labels[language].description;
  document.querySelector('meta[property="og:title"]').content = labels[language].title;
  document.querySelector('meta[property="og:description"]').content = labels[language].description;
  document.querySelector('#language-label').textContent = language === 'en' ? '中文' : 'EN';
  document.querySelector('#language-toggle').setAttribute('aria-label', labels[language].switchLanguage);
  document.querySelector('#documentation-link').href = `https://github.com/quguai/sovel-player/blob/main/README${language === 'zh' ? '.zh-CN' : ''}.md`;
  refreshLabels();
  if (remember) {
    savePreference('language', language);
    const url = new URL(location.href);
    url.searchParams.set('lang', language);
    history.replaceState(null, '', url);
  }
}

async function setMaterial(value, remember = true) {
  if (!(value in paths)) return;
  const revision = ++materialRevision;
  loadingMaterial = true;
  materialError = false;
  updateMaterialCaption();
  preview.setAttribute('aria-busy', 'true');
  try {
    const image = new Image();
    image.src = paths[value];
    await image.decode();
    if (revision !== materialRevision) return;
    texture.src = paths[value];
    material = value;
    preview.dataset.material = value;
    swatches.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.material === value)));
    if (remember) savePreference('material', value);
  } catch {
    if (revision !== materialRevision) return;
    materialError = true;
  } finally {
    if (revision === materialRevision) {
      loadingMaterial = false;
      preview.removeAttribute('aria-busy');
      updateMaterialCaption();
    }
  }
}
function selectScreen(value, focus = false) {
  const index = tabs.findIndex(tab => tab.dataset.screen === value);
  if (index === -1) return;
  selectedScreen = value;
  tabs.forEach(tab => {
    const active = tab.dataset.screen === value;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  screen.src = `./assets/screen-${value === 'player' ? selectedVinyl : value}.png`;
  screen.alt = labels[language][`${value === 'player' ? selectedVinyl : value}Alt`];
  document.querySelector('.dap-materials').hidden = value !== 'player';
  document.querySelector('#screen-panel').setAttribute('aria-labelledby', tabs[index].id);
  document.querySelector('#stage-counter').textContent = `0${index + 1} — 0${tabs.length}`;
  if (focus) tabs[index].focus();
}

function refreshGitHub() {
  const copy = labels[language];
  const star = document.querySelector('.header-github');
  const count = document.querySelector('#star-count');
  count.textContent = github.stars === null ? '—' : new Intl.NumberFormat(language).format(github.stars);
  star.setAttribute('aria-label', `${copy.star}${github.stars === null ? '' : ` · ${github.stars} ${copy.starCount}`}`);
  const view = releaseView(github, copy, language);
  document.querySelector('#release-card').setAttribute('aria-busy', String(github.release === undefined && !github.error));
  if (view) {
    document.querySelector('#release-title').textContent = view.title;
    document.querySelector('#release-status').textContent = view.description;
    document.querySelector('#release-channel').textContent = view.channel;
    const download = document.querySelector('#release-download');
    download.href = view.href;
    download.querySelector('span').textContent = view.button;
    download.querySelector('use').setAttribute('href', view.asset ? '#download-icon' : '#arrow-up');
    const notes = document.querySelector('#release-notes');
    notes.href = view.notes ?? `${repositoryUrl}/releases`;
    notes.textContent = view.notes ? copy.releaseNotes : copy.releaseHistory;
  }
}

document.querySelector('#language-toggle').addEventListener('click', () => setLanguage(language === 'en' ? 'zh' : 'en', true));
playButton.addEventListener('click', () => { playing = !playing; refreshAnimation(); });
swatches.forEach(button => button.addEventListener('click', () => setMaterial(button.dataset.material)));
tabs.forEach(tab => {
  tab.addEventListener('click', () => selectScreen(tab.dataset.screen));
  tab.addEventListener('keydown', event => {
    const index = tabs.indexOf(tab);
    let next;
    if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (index + 1) % tabs.length;
    else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); selectScreen(tabs[next].dataset.screen, true); }
  });
});
document.querySelectorAll('[data-vinyl]').forEach(button => button.addEventListener('click', () => {
  selectedVinyl = button.dataset.vinyl;
  document.querySelectorAll('[data-vinyl]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  selectScreen('player');
}));
function updateTabOrientation() {
  document.querySelector('.experience-tabs').setAttribute('aria-orientation', compact.matches ? 'horizontal' : 'vertical');
}
compact.addEventListener('change', updateTabOrientation);
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) playing = false; refreshAnimation(); });
document.addEventListener('visibilitychange', refreshAnimation);
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; refreshAnimation(); }).observe(preview);
}
setLanguage(language);
updateTabOrientation();
const savedMaterial = readPreference('material');
if (savedMaterial && savedMaterial in paths && savedMaterial !== material) setMaterial(savedMaterial, false);
loadGitHub(update => { github = { ...github, ...update }; refreshGitHub(); });
