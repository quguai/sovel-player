// Each housing has its own aperture geometry, label and spool material.
const geometry = {
  classic: { left:120.3, right:298.1, y:128.8, outer:24.5, hub:12, tape:'#483b2e', spool:'#e6e1d6', ink:'#292a27', titleX:51, titleY:84, artistY:177, size:12.5 },
  studio: { left:129.5, right:291.4, y:130.5, outer:37, hub:15, tape:'#353e43', spool:'#b9c5c9', ink:'#202c32', titleX:57, titleY:82, artistY:178, size:13 },
  pop: { left:129.3, right:290.6, y:137.5, outer:28.5, hub:13, tape:'#27435a', spool:'#e7e6dc', ink:'#122e46', titleX:88, titleY:66, artistY:88, size:23 },
};

export function editionCassette({ title='', artist='', id, finish, material, preview=false }) {
  const g = geometry[finish];
  const reel = (side, x) => `<g transform="translate(${x} ${g.y})">
    <circle r="${g.outer+8}" fill="#10181c"/>
    <circle class="cassette-tape-${side}" data-tape-min="${g.hub+2}" data-tape-max="${g.outer}" r="${g.outer}" fill="${g.tape}"/>
    <g clip-path="url(#${id}-${side})">${Array.from({length:18},(_, i)=>`<circle r="${g.hub+2+i*(g.outer-g.hub-2)/17}" fill="none" stroke="#d6c9b0" stroke-opacity=".23" stroke-width=".35"/>`).join('')}</g>
    <g class="cassette-hub"><circle r="${g.hub}" fill="${g.spool}" stroke="#879095" stroke-width=".5"/>
      <circle r="${g.hub*.65}" fill="#172127"/>
      ${Array.from({length:6},(_,i)=>`<rect x="-1.5" y="${-g.hub*.84}" width="3" height="${g.hub*.43}" rx=".8" fill="${g.spool}" transform="rotate(${i*60})"/>`).join('')}
      <circle r="${g.hub*.28}" fill="${g.spool}"/>
    </g>
  </g>`;
  const svg = `<svg class="cassette-object" viewBox="0 0 420 270" role="img" aria-label="${material.name} · ${title}">
    <defs>${['left','right'].map(side=>`<clipPath id="${id}-${side}"><circle class="cassette-tape-${side}" data-tape-min="${g.hub+2}" data-tape-max="${g.outer}" r="${g.outer}"/></clipPath>`).join('')}
      <clipPath id="${id}-label"><rect x="${g.titleX}" y="${g.titleY-25}" width="${380-g.titleX}" height="35"/></clipPath>
      <clipPath id="${id}-artist"><rect x="${g.titleX}" y="${g.artistY-12}" width="${finish==='studio'?240:300}" height="17"/></clipPath>
    </defs>
    <rect x="35" y="95" width="350" height="80" fill="#151e23"/>
    ${reel('left',g.left)}${reel('right',g.right)}
    <image href="/mobile/assets/cassette/${material.shell}" width="420" height="270" preserveAspectRatio="none"/>
    <text x="${g.titleX}" y="${g.titleY}" fill="${g.ink}" font-size="${title.length>18?Math.min(g.size,12):g.size}" font-weight="600" clip-path="url(#${id}-label)">${title}</text>
    <text x="${g.titleX}" y="${g.artistY}" fill="${g.ink}" opacity=".75" font-size="9" clip-path="url(#${id}-artist)">${artist}</text>
  </svg>`;
  if (preview) return svg;
  return `<figure class="cassette-stage cassette-edition" data-cassette-finish="${finish}"><div class="cassette-overline"><span>SOVEL · ANALOG COLLECTION</span><span>SIDE A</span></div>${svg}<figcaption><span class="cassette-status"><i></i><span class="tape-state-playing">NOW PLAYING</span><span class="tape-state-paused">PAUSED</span></span><span>${material.name}</span></figcaption></figure>`;
}
