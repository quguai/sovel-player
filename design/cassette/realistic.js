// A generated shell sits above independently animated tape packs and reel hubs.
// Coordinates are calibrated to the 1564 × 1006 transparent shell asset.
export function realisticCassette({ title, artist, cover, id, finish, material, preview = false }) {
  const reel = (x, side) => `<g transform="translate(${x} 123.5)">
    <circle r="65" fill="url(#${id}-well)"/>
    <circle class="cassette-tape-${side}" data-tape-min="23" data-tape-max="63" r="47" fill="url(#${id}-tape)" stroke="#765d43" stroke-width=".6"/>
    <g clip-path="url(#${id}-${side}-pack)"><g class="cassette-hub cassette-winding" data-reel="${side}">
      ${Array.from({ length: 62 }, (_, i) => `<circle r="${24 + i * .64}" fill="none" stroke="${i % 3 ? '#9b7855' : '#090a09'}" stroke-opacity="${i % 3 ? '.23' : '.55'}" stroke-width=".3"/>`).join('')}
      <path d="M-60-18Q-15-12 63-7M-58 9Q12 2 61 15" fill="none" stroke="#c6a378" stroke-opacity=".1" stroke-width=".7"/>
    </g></g>
  </g>`;
  const hub = x => `<g transform="translate(${x} 123.5)">
    <circle r="23" fill="#070909" stroke="#aeb8bb" stroke-width=".5"/>
    <g class="cassette-hub cassette-metal-hub"><image class="cassette-silver-material" href="/mobile/assets/cassette/noir-hub-v2.png" x="-23" y="-23" width="46" height="46"/></g>
    <circle r="23.5" fill="url(#${id}-reflection)"/>
  </g>`;
  return `${preview ? '' : `<figure class="cassette-stage cassette-realistic" data-cassette-finish="${finish}" aria-label="${material.name}磁带，透明窗口内的带卷随播放转动">
    <div class="cassette-overline"><span>SOVEL · ANALOG COLLECTION</span><span>SIDE A</span></div>`}
    <svg class="cassette-object" viewBox="0 0 420 270" role="img" aria-label="${title} · ${artist}">
      <defs>
        <radialGradient id="${id}-well"><stop stop-color="#32352e"/><stop offset=".7" stop-color="#1b211e"/><stop offset="1" stop-color="#080c0c"/></radialGradient>
        <radialGradient id="${id}-tape"><stop stop-color="#17130f"/><stop offset=".5" stop-color="#32291f"/><stop offset=".94" stop-color="#49392b"/><stop offset="1" stop-color="#776044"/></radialGradient>
        <linearGradient id="${id}-reflection" x2=".7" y2="1"><stop stop-color="#e3e9ec" stop-opacity=".18"/><stop offset=".35" stop-color="#cbd9df" stop-opacity=".01"/><stop offset=".75" stop-color="#d4e0e7" stop-opacity=".02"/><stop offset="1" stop-color="#c9d9df" stop-opacity=".1"/></linearGradient>
        <radialGradient id="${id}-shell-alpha"><stop offset=".59" stop-color="white"/><stop offset=".7" stop-color="white"/><stop offset=".79" stop-color="#737373"/><stop offset=".95" stop-color="#898989"/><stop offset="1" stop-color="white"/></radialGradient>
        <mask id="${id}-shell-mask"><rect width="420" height="270" fill="white"/><circle cx="120.5" cy="123.5" r="65" fill="url(#${id}-shell-alpha)"/><circle cx="297" cy="123.5" r="65" fill="url(#${id}-shell-alpha)"/><rect x="20" y="29" width="380" height="42" fill="white"/></mask>
        ${['left', 'right'].map(side => `<clipPath id="${id}-${side}-pack"><circle class="cassette-tape-${side}" data-tape-min="23" data-tape-max="63" r="47"/></clipPath>`).join('')}
        <clipPath id="${id}-inside"><rect x="45" y="73" width="330" height="125" rx="18"/></clipPath>
        <clipPath id="${id}-title"><rect x="40" y="43" width="301" height="22"/></clipPath>
        <clipPath id="${id}-cover"><rect x="350" y="37" width="25" height="25" rx="2"/></clipPath>
      </defs>
      <rect x="8" y="14" width="404" height="238" rx="17" fill="#171d1b" fill-opacity=".7"/>
      <g clip-path="url(#${id}-inside)">${reel(120.5, 'left')}${reel(297, 'right')}</g>
      <image class="cassette-shell-material ${material.monochrome ? 'cassette-silver-material' : ''}" href="/mobile/assets/cassette/${material.shell}" width="420" height="270" preserveAspectRatio="none" mask="url(#${id}-shell-mask)"/>
      <path class="cassette-travelling-tape" d="M53 211L86 192Q210 181 334 192L365 211" fill="none" stroke="#c5a57e" stroke-opacity=".28" stroke-width=".65" stroke-dasharray="3 25"/>
      ${hub(120.5)}${hub(297)}
      <g clip-path="url(#${id}-inside)" pointer-events="none"><path d="M53 79L315 74 368 123 331 181Z" fill="url(#${id}-reflection)" opacity=".38"/></g>
      <text x="40" y="41" fill="var(--cassette-label-muted)" font-size="5.2" letter-spacing="2">SOVEL / CHROME · 60</text>
      <g clip-path="url(#${id}-title)"><text x="40" y="57" fill="var(--cassette-label-ink)" font-size="11" font-weight="500">${title}<tspan dx="10" font-size="7.5" fill="var(--cassette-label-muted)">${artist}</tspan></text></g>
      ${cover ? `<image href="${cover}" x="350" y="37" width="25" height="25" clip-path="url(#${id}-cover)" preserveAspectRatio="xMidYMid slice" opacity=".87"/>` : ''}
      <text x="210" y="128" text-anchor="middle" fill="#b1bcc2" font-size="5" letter-spacing="1.5">SIDE A</text>
    </svg>
    ${preview ? '' : `<figcaption><span class="cassette-status"><i></i><span class="tape-state-playing">NOW PLAYING</span><span class="tape-state-paused">PAUSED</span></span><span>${material.name} · CHROME</span></figcaption>
  </figure>`}`;
}
