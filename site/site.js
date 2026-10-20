import { zh, labels } from './copy.js';
import { initStory } from './story.js';
import { loadGitHub, releaseView, repositoryUrl, bindReleaseDownloads } from './github.js';

const preview = document.querySelector('#record-preview');
const playButton = document.querySelector('#record-play');
const record = document.querySelector('.record-spin');
const materialName = document.querySelector('#material-name');
const texture = document.querySelector('#record-texture');
const swatches = [...document.querySelectorAll('.material-swatch')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const localized = [...document.querySelectorAll('[data-i18n], [data-i18n-html]')].map(element => ({
  element,
  key: element.dataset.i18n ?? element.dataset.i18nHtml,
  html: element.hasAttribute('data-i18n-html'),
  english: element.hasAttribute('data-i18n-html') ? element.innerHTML : element.textContent,
}));
const paths = { black: './assets/record-black.png', smoke: './assets/record-smoke.png', blue: './assets/record-blue.png' };
const refreshDownloads = bindReleaseDownloads(document.querySelectorAll('[data-release-download]'));

function readPreference(key) {
  try { return localStorage.getItem(`sovel-site-${key}`); } catch { return null; }
}
function savePreference(key, value) {
  try { localStorage.setItem(`sovel-site-${key}`, value); } catch { /* Browsing without storage still works. */ }
}
const requested = new URLSearchParams(location.search).get('lang');
let language = (requested ?? readPreference('language')) === 'zh' ? 'zh' : 'en';
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
  swatches.forEach(button => button.setAttribute('aria-label', copy[button.dataset.material]));
  document.querySelectorAll('[data-screen-alt]').forEach(image => { image.alt = copy[`${image.dataset.screenAlt}Alt`]; });
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
function refreshGitHub() {
  const copy = labels[language];
  const star = document.querySelector('.header-github');
  const count = document.querySelector('#star-count');
  count.textContent = github.stars === null ? '—' : new Intl.NumberFormat(language).format(github.stars);
  star.setAttribute('aria-label', `${copy.star}${github.stars === null ? '' : ` · ${github.stars} ${copy.starCount}`}`);
  const view = releaseView(github, copy, language);
  refreshDownloads(view, copy);
  document.querySelector('#release-card').setAttribute('aria-busy', String(github.release === undefined && !github.error));
  if (view) {
    document.querySelector('#release-title').textContent = view.title;
    document.querySelector('#release-status').textContent = view.description;
    document.querySelector('#release-channel').textContent = view.channel;
    const notes = document.querySelector('#release-notes');
    notes.href = view.notes ?? `${repositoryUrl}/releases`;
    notes.textContent = view.notes ? copy.releaseNotes : copy.releaseHistory;
  }
}

document.querySelector('#language-toggle').addEventListener('click', () => setLanguage(language === 'en' ? 'zh' : 'en', true));
playButton.addEventListener('click', () => { playing = !playing; refreshAnimation(); });
swatches.forEach(button => button.addEventListener('click', () => setMaterial(button.dataset.material)));
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) playing = false; refreshAnimation(); });
document.addEventListener('visibilitychange', refreshAnimation);
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; refreshAnimation(); }).observe(preview);
}
setLanguage(language);
initStory();
const savedMaterial = readPreference('material');
if (savedMaterial && savedMaterial in paths && savedMaterial !== material) setMaterial(savedMaterial, false);
loadGitHub(update => { github = { ...github, ...update }; refreshGitHub(); });
