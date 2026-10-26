import { realisticCassette } from './realistic.js';
import { editionCassette } from './editions.js';

const materials = {
  noir: { name: '烟透银灰', shell: 'noir-shell-v2.png', monochrome: true },
  classic: { name: '经典纸标', shell: 'classic-shell-v5.png' },
  studio: { name: '金属机能', shell: 'studio-shell-v5.png' },
  pop: { name: '随身 PLAY', shell: 'pop-shell-v5.png' },
};
export const cassetteStyles = Object.fromEntries(Object.entries(materials).map(([key, material]) => [key, material.name]));
let instance = 0;
export function cassetteArtwork({ title, artist, cover, finish }) {
  const key = Object.hasOwn(materials, finish) ? finish : 'noir';
  return (key === 'noir' ? realisticCassette : editionCassette)({
    title, artist, cover, id: `tape-${++instance}`, finish: key, material: materials[key],
  });
}
export function cassettePreview(finish) {
  const key = Object.hasOwn(materials, finish) ? finish : 'noir';
  return `<span class="cassette-mini" data-cassette-finish="${key}" aria-hidden="true">${(key === 'noir' ? realisticCassette : editionCassette)({title:'', artist:'', cover:'', id:`tape-preview-${++instance}`, finish:key, material:materials[key], preview:true})}</span>`;
}
