import { readFileSync } from 'node:fs';
import { type Day, type Theme, profile, toWeeks, monthTicks, esc, fmt, r, FONT, svgDoc, longDate, weekRange } from './lib.ts';
import { type Preset, CITIES } from './presets.ts';

type Pt = [number, number];
type Geo = { extent: [number, number, number, number]; home: Pt[][]; neighbours: Pt[][]; river: Pt[]; context: Pt[][] };
type Box = [number, number, number, number];

const PALETTE = {
  dark: {
    panel: '#161b22', land: '#121821', landStroke: '#3d444d', dots: '#2a313b',
    neighbour: '#10151c', neighbourStroke: '#262c35', grat: '#1a2029',
    context: '#388bfd', contextOpacity: 0.32,
    river: '#58a6ff', glow: 0.55, flow: '#d6ecff',
    text: '#e6edf3', text2: '#9198a1', text3: '#6e7681', border: '#30363d', accent: '#ff7b72',
  },
  light: {
    panel: '#ffffff', land: '#ffffff', landStroke: '#8c959f', dots: '#d6dde5',
    neighbour: '#f6f8fa', neighbourStroke: '#e1e6eb', grat: '#eaeef2',
    context: '#54aeff', contextOpacity: 0.55,
    river: '#0969da', glow: 0, flow: '#b6e3ff',
    text: '#1f2328', text2: '#59636e', text3: '#6e7781', border: '#d1d9e0', accent: '#cf222e',
  },
};

const W = 900, H = 500;
const MAP = { x: 372, y: 34, w: 500, h: 432 };
const LABEL_AREA: Box = [350, 8, W - 8, H - 8];
const MIN_W = 1.4, MAX_W = 18;
const REVEAL_START = 0.9, REVEAL_DUR = 3.4;

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase().trim();

/** Approximate text box — good enough to keep labels apart. */
function textBox(x: number, y: number, anchor: string, text: string, size: number, spacing = 0, bold = false): Box {
  const w = text.length * size * (bold ? 0.6 : 0.56) + text.length * spacing * size;
  const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  return [x0 - 1, y - size * 0.78, x0 + w + 1, y + size * 0.2];
}
const hits = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
const insideArea = (b: Box) => b[0] >= LABEL_AREA[0] && b[2] <= LABEL_AREA[2] && b[1] >= LABEL_AREA[1] && b[3] <= LABEL_AREA[3];

export function renderRiver(days: Day[], theme: Theme, preset: Preset, geoPath: string): string {
  const c = PALETTE[theme];
  const geo = JSON.parse(readFileSync(geoPath, 'utf8')) as Geo;
  const weeks = toWeeks(days);
  const n = weeks.length;
  const total = days.reduce((s, d) => s + d.count, 0);
  const peak = weeks.reduce((m, w, i) => (w.total > weeks[m].total ? i : m), 0);
  const peakVal = Math.max(1, weeks[peak].total);

  // ── projection: equirectangular with cos(mid-latitude), fitted to the map box ──
  const [lon0, lat0, lon1, lat1] = geo.extent;
  const COS = Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180);
  const k = Math.min(MAP.w / ((lon1 - lon0) * COS), MAP.h / (lat1 - lat0));
  const ox = MAP.x + (MAP.w - (lon1 - lon0) * COS * k) / 2;
  const oy = MAP.y + (MAP.h - (lat1 - lat0) * k) / 2;
  const P = ([lon, lat]: Pt): Pt => [ox + (lon - lon0) * COS * k, oy + (lat1 - lat) * k];
  const path = (pts: Pt[], close = false) =>
    pts.map((p, i) => { const [x, y] = P(p); return `${i ? 'L' : 'M'}${r(x)} ${r(y)}`; }).join('') + (close ? 'Z' : '');
  const center = P([(lon0 + lon1) / 2, (lat0 + lat1) / 2]);

  // ── river sampled evenly along its length ──
  const raw = geo.river.map(P);
  const cum = [0];
  for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
  const L = cum[cum.length - 1];
  const at = (s: number): Pt => {
    const i = cum.findIndex((v) => v >= s);
    if (i <= 0) return raw[Math.max(i, 0)];
    const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return [raw[i - 1][0] + t * (raw[i][0] - raw[i - 1][0]), raw[i - 1][1] + t * (raw[i][1] - raw[i - 1][1])];
  };
  const N = 600;
  const pts = Array.from({ length: N }, (_, i) => at((i / (N - 1)) * L));
  const normal = (i: number): Pt => {
    const a = pts[Math.max(0, i - 4)], b = pts[Math.min(N - 1, i + 4)];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len];
  };
  const widthAt = (f: number) => {
    const pos = f * n - 0.5;
    const i0 = Math.max(0, Math.min(n - 1, Math.floor(pos)));
    const i1 = Math.min(n - 1, i0 + 1);
    const u = Math.max(0, Math.min(1, pos - i0));
    const s = u * u * (3 - 2 * u);
    return MIN_W + ((weeks[i0].total * (1 - s) + weeks[i1].total * s) / peakVal) * (MAX_W - MIN_W);
  };
  const left: string[] = [], right: string[] = [];
  pts.forEach((p, i) => {
    const [nx, ny] = normal(i);
    const hw = widthAt(i / (N - 1)) / 2;
    left.push(`${r(p[0] + nx * hw)} ${r(p[1] + ny * hw)}`);
    right.push(`${r(p[0] - nx * hw)} ${r(p[1] - ny * hw)}`);
  });
  const ribbon = `M${left.join('L')}L${right.reverse().join('L')}Z`;
  const centerD = `M${pts.map((p) => `${r(p[0])} ${r(p[1])}`).join('L')}`;
  const pointAt = (f: number) => { const i = Math.round(f * (N - 1)); return { p: pts[i], nrm: normal(i), hw: widthAt(f) / 2 }; };

  // ── label placement: every label takes free space, river included ──
  const taken: Box[] = [];
  for (let i = 0; i < N; i += 3) {
    const hw = widthAt(i / (N - 1)) / 2 + 0.5;
    taken.push([pts[i][0] - hw, pts[i][1] - hw, pts[i][0] + hw, pts[i][1] + hw]);
  }
  const free = (boxes: Box[]) => boxes.every((b) => insideArea(b) && !taken.some((t) => hits(t, b)));
  const take = (boxes: Box[]) => taken.push(...boxes);

  const out: string[] = [];

  // sea name
  if (preset.sea) {
    const [sx, sy] = P([preset.sea.lon, preset.sea.lat]);
    const b = textBox(sx, sy, 'start', preset.sea.name, 10.5, 0.12);
    if (free([b])) { take([b]); out.push(`<text class="sea" x="${r(sx)}" y="${r(sy)}">${esc(preset.sea.name)}</text>`); }
  }

  // cities: the ones along the river + the user's home city if it is on the map
  const homeKey = norm(profile.city);
  const isHome = (ct: { name: string; alt?: string[] }) => !!homeKey && (norm(ct.name) === homeKey || !!ct.alt?.some((a) => norm(a) === homeKey));
  const homeCity = CITIES.find(isHome);
  const shown = CITIES.filter((ct) => preset.cities.includes(ct.name) || ct === homeCity).filter((ct) => {
    const [x, y] = P([ct.lon, ct.lat]);
    return x > MAP.x - 10 && x < W - 10 && y > 10 && y < H - 10;
  });
  const cityPos = shown.map((ct) => ({ ct, xy: P([ct.lon, ct.lat]), home: isHome(ct) }));
  cityPos.forEach(({ xy: [x, y] }) => take([[x - 3, y - 3, x + 3, y + 3]]));
  const cities = cityPos
    .sort((a, b) => Number(b.home) - Number(a.home))
    .map(({ ct, xy: [x, y], home }) => {
      const size = 11.5;
      const base: [number, number, string][] = [[9, 4, 'start'], [-9, 4, 'end'], [0, -8, 'middle'], [0, 15, 'middle'], [7, -6, 'start'], [-7, -6, 'end'], [7, 14, 'start'], [-7, 14, 'end']];
      const cands = [1, 1.7, 2.5].flatMap((m) => base.map(([dx, dy, a]) => [x + dx * m, y + (dy > 0 ? 4 + (dy - 4) * m : dy * m), a] as [number, number, string]));
      const pick = cands.find(([tx, ty, a]) => free([textBox(tx, ty, a, ct.name, size, 0, home)]));
      const dot = home
        ? `<circle class="pulse" cx="${r(x)}" cy="${r(y)}" r="3.2" fill="${c.accent}"/><circle cx="${r(x)}" cy="${r(y)}" r="3.2" fill="${c.accent}" stroke="${c.panel}" stroke-width="1.5"/>`
        : `<circle cx="${r(x)}" cy="${r(y)}" r="2.4" fill="${c.text2}" stroke="${c.panel}" stroke-width="1.2"/>`;
      let label = '';
      if (pick) {
        take([textBox(pick[0], pick[1], pick[2], ct.name, size, 0, home)]);
        label = `<text class="${home ? 'city home' : 'city'} halo" x="${r(pick[0])}" y="${r(pick[1])}" text-anchor="${pick[2]}">${esc(ct.name)}</text>`;
      }
      return `<g class="in" style="animation-delay:${home ? 1.6 : 1.2}s">${dot}${label}</g>`;
    })
    .join('');

  // source and mouth
  const placeNote = (p: Pt, text: string, cands: [number, number, string][], delay: number, dot = '') => {
    const pick = cands.find(([dx, dy, a]) => free([textBox(p[0] + dx, p[1] + dy, a, text, 11.5)]));
    if (!pick) return dot ? `<g class="in" style="animation-delay:${r(delay)}s">${dot}</g>` : '';
    take([textBox(p[0] + pick[0], p[1] + pick[1], pick[2], text, 11.5)]);
    return `<g class="in" style="animation-delay:${r(delay)}s">${dot}<text class="small halo" x="${r(p[0] + pick[0])}" y="${r(p[1] + pick[1])}" text-anchor="${pick[2]}">${esc(text)}</text></g>`;
  };
  const src = pts[0], mouth = pts[N - 1];
  const around: [number, number, string][] = [[-8, 14, 'end'], [8, 14, 'start'], [-9, 4, 'end'], [9, 4, 'start'], [0, -9, 'middle'], [0, 17, 'middle']];
  out.push(placeNote(src, `source · ${longDate(weeks[0].start)}`, around, REVEAL_START, `<circle cx="${r(src[0])}" cy="${r(src[1])}" r="2" fill="${c.river}"/>`));
  out.push(placeNote(mouth, 'mouth · this week', [[10, 8, 'start'], [-10, 8, 'end'], [10, -4, 'start'], [-10, -4, 'end'], [0, 20, 'middle'], [0, -12, 'middle']], REVEAL_START + REVEAL_DUR));

  // busiest week callout — left or right of the river, whichever is free
  const pk = pointAt((peak + 0.5) / n);
  const peakText = `busiest week ${fmt(peakVal)}`;
  for (const side of [-1, 1]) {
    const lx = pk.p[0] + side * (pk.hw + 27), anchor = side < 0 ? 'end' : 'start';
    const boxes = [textBox(lx, pk.p[1] + 1, anchor, peakText, 12, 0, true), textBox(lx, pk.p[1] + 15, anchor, weekRange(weeks[peak]), 11.5)];
    const lead: Box = [Math.min(pk.p[0] + side * (pk.hw + 3), pk.p[0] + side * (pk.hw + 22)), pk.p[1] - 1, Math.max(pk.p[0] + side * (pk.hw + 3), pk.p[0] + side * (pk.hw + 22)), pk.p[1] + 1];
    if (!free([...boxes, lead])) continue;
    take([...boxes, lead]);
    out.push(
      `<g class="in" style="animation-delay:${r(REVEAL_START + REVEAL_DUR + 0.2)}s">` +
      `<line x1="${r(pk.p[0] + side * (pk.hw + 3))}" y1="${r(pk.p[1])}" x2="${r(pk.p[0] + side * (pk.hw + 22))}" y2="${r(pk.p[1])}" stroke="${c.text3}"/>` +
      `<text class="anno halo" x="${r(lx)}" y="${r(pk.p[1] + 1)}" text-anchor="${anchor}"><tspan class="small">busiest week</tspan> ${fmt(peakVal)}</text>` +
      `<text class="small halo" x="${r(lx)}" y="${r(pk.p[1] + 15)}" text-anchor="${anchor}">${weekRange(weeks[peak])}</text></g>`,
    );
    break;
  }

  // river name along the current, on whichever side is free
  const spaced = [...preset.label].join(' ');
  const need = spaced.length * 6.2 * 1.2;
  let riverName = '', lblDef = '';
  if (need < L * 0.5) {
    for (const f0 of [0.3, 0.45, 0.15, 0.6]) {
      const i0 = Math.round(f0 * (N - 1)), i1 = Math.min(N - 1, i0 + Math.ceil((need / L) * (N - 1)));
      let done = false;
      for (const side of [-1, 1]) {
        const seg = pts.slice(i0, i1 + 1).map((p, j) => {
          const [nx, ny] = normal(i0 + j);
          const off = widthAt((i0 + j) / (N - 1)) / 2 + 8;
          return [p[0] + side * nx * off, p[1] + side * ny * off] as Pt;
        });
        const boxes = seg.filter((_, j) => j % 3 === 0).map(([x, y]) => [x - 4, y - 5, x + 4, y + 5] as Box);
        if (!free(boxes)) continue;
        take(boxes);
        if (seg[seg.length - 1][0] < seg[0][0]) seg.reverse(); // keep text upright
        lblDef = `<path id="lblpath" d="M${seg.map(([x, y]) => `${r(x)} ${r(y)}`).join('L')}"/>`;
        riverName = `<text class="river in" style="animation-delay:${r(REVEAL_START + REVEAL_DUR * f0)}s" dy="3.5"><textPath href="#lblpath" startOffset="50%" text-anchor="middle">${esc(spaced)}</textPath></text>`;
        done = true;
        break;
      }
      if (done) break;
    }
  }

  // month ticks on the river, lit when the current reaches them
  const ticks = monthTicks(weeks).map((t) => {
    const f = t.index / n;
    const { p, nrm, hw } = pointAt(f);
    for (const side of [1, -1]) {
      const a = [p[0] + nrm[0] * side * (hw + 2), p[1] + nrm[1] * side * (hw + 2)];
      const b = [p[0] + nrm[0] * side * (hw + 7), p[1] + nrm[1] * side * (hw + 7)];
      const tx = p[0] + nrm[0] * side * (hw + 10), ty = p[1] + nrm[1] * side * (hw + 10) + 3.5;
      const anchor = nrm[0] * side < -0.3 ? 'end' : nrm[0] * side > 0.3 ? 'start' : 'middle';
      const box = textBox(tx, ty, anchor, t.label, 10);
      if (!free([box])) continue;
      take([box]);
      return `<g class="pop" style="animation-delay:${r(REVEAL_START + REVEAL_DUR * f)}s"><line x1="${r(a[0])}" y1="${r(a[1])}" x2="${r(b[0])}" y2="${r(b[1])}" stroke="${c.text3}" stroke-width="1"/><text class="tick halo" x="${r(tx)}" y="${r(ty)}" text-anchor="${anchor}">${t.label}</text></g>`;
    }
    return '';
  });

  // ── background: neighbours, graticule, other rivers ──
  const span = Math.max(lon1 - lon0, lat1 - lat0);
  const step = span > 30 ? 10 : span > 14 ? 5 : span > 6 ? 2 : 1;
  const grat: string[] = [];
  for (let lat = Math.ceil(lat0 / step) * step; lat <= lat1; lat += step) grat.push(`M${MAP.x - 80} ${r(P([0, lat])[1])}H${W}`);
  for (let lon = Math.ceil(lon0 / step) * step; lon <= lon1; lon += step) grat.push(`M${r(P([lon, 0])[0])} 0V${H}`);
  const neighbours = geo.neighbours.map((ring) => `<path d="${path(ring, true)}"/>`).join('');
  const context = geo.context.map((l) => `<path d="${path(l)}"/>`).join('');
  const homePath = geo.home.map((ring) => path(ring, true)).join('');

  // ── text column: the river, straightened — same width scale, time axis below ──
  const ux0 = 28, ux1 = 336, uy = 262, UK = 2;
  const top: string[] = [], bot: string[] = [];
  for (let i = 0; i <= 160; i++) {
    const f = i / 160, x = ux0 + f * (ux1 - ux0), hw = (widthAt(f) * UK) / 2;
    top.push(`${r(x)} ${r(uy - hw)}`);
    bot.push(`${r(x)} ${r(uy + hw)}`);
  }
  const uPeakX = ux0 + ((peak + 0.5) / n) * (ux1 - ux0);
  const uTicks = monthTicks(weeks).filter((_, i) => i % 2 === 0).map((t) => {
    const x = ux0 + (t.index / n) * (ux1 - ux0);
    return `<line x1="${r(x)}" x2="${r(x)}" y1="${uy + 22}" y2="${uy + 26}" stroke="${c.text3}"/><text class="tick" x="${r(x)}" y="${uy + 38}" text-anchor="middle">${t.label}</text>`;
  }).join('');
  const peakLabelAnchor = uPeakX - ux0 < 140 ? 'start' : 'end';
  const intro = `<g class="intro">
<text class="t1" x="20" y="30">The year, as the ${esc(preset.label)}</text>
<text class="body" x="28" y="72">Source: a year ago, ${esc(preset.sourceText)}.</text>
<text class="body" x="28" y="92">Mouth: this week, ${esc(preset.mouthText)}.</text>
<text class="body" x="28" y="120">The river's width at every bend is the</text>
<text class="body" x="28" y="140">number of contributions that week.</text>
<text class="lbl" x="${ux0}" y="${uy - 62}">THE RIVER, STRAIGHTENED · 2× WIDTH</text>
<g class="unroll"><path d="M${top.join('L')}L${bot.reverse().join('L')}Z" fill="${c.river}"/></g>
<line x1="${ux0}" x2="${ux1}" y1="${uy + 22.5}" y2="${uy + 22.5}" stroke="${c.grat}"/>${uTicks}
<g class="in" style="animation-delay:${r(REVEAL_START + REVEAL_DUR)}s"><line x1="${r(uPeakX)}" x2="${r(uPeakX)}" y1="${r(uy - MAX_W - 3)}" y2="${uy - 26}" stroke="${c.text3}"/><text class="small" x="${r(uPeakX + (peakLabelAnchor === 'end' ? -4 : 4))}" y="${uy - 30}" text-anchor="${peakLabelAnchor}">busiest week · ${fmt(peakVal)}</text></g>
<text class="foot" x="28" y="${H - 22}">map: Natural Earth</text>
</g>`;

  const mx = MAP.x - 40;
  const defs = `<defs>
<clipPath id="card"><rect width="${W}" height="${H}" rx="6"/></clipPath>
<radialGradient id="fadeG" gradientUnits="userSpaceOnUse" cx="${r(center[0])}" cy="${r(center[1])}" r="330"><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<mask id="fade" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect x="${mx}" width="${W - mx}" height="${H}" fill="url(#fadeG)"/></mask>
<linearGradient id="leftG" gradientUnits="userSpaceOnUse" x1="${MAP.x - 34}" x2="${MAP.x + 6}" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>
<mask id="left" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#leftG)"/></mask>
<pattern id="dots" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r=".8" fill="${c.dots}"/></pattern>
<clipPath id="home"><path d="${homePath}"/></clipPath>
<mask id="reveal" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><path class="reveal" d="${centerD}" pathLength="100" fill="none" stroke="#fff" stroke-width="${MAX_W + 10}" stroke-linejoin="round"/></mask>
<filter id="glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4"/></filter>
${lblDef}
</defs>`;

  const body = `${defs}
<g clip-path="url(#card)">
<rect width="${W}" height="${H}" fill="${c.panel}"/>
<g mask="url(#left)">
<g mask="url(#fade)">
<g class="in" style="animation-delay:.2s" fill="${c.neighbour}" stroke="${c.neighbourStroke}" stroke-width=".7">${neighbours}</g>
<path class="in" style="animation-delay:.2s" d="${grat.join('')}" stroke="${c.grat}" stroke-width="1" fill="none"/>
</g>
<path class="in" style="animation-delay:.3s" d="${homePath}" fill="${c.land}"/>
<path class="in" style="animation-delay:.5s" d="${homePath}" fill="url(#dots)"/>
<path class="outline" d="${homePath}" pathLength="100" fill="none" stroke="${c.landStroke}" stroke-width="1" stroke-linejoin="round"/>
<g class="in" style="animation-delay:.7s" clip-path="url(#home)" fill="none" stroke="${c.context}" stroke-opacity="${c.contextOpacity}" stroke-width=".9" stroke-linejoin="round" stroke-linecap="round">${context}</g>
</g>
<g mask="url(#reveal)">
${c.glow ? `<path d="${ribbon}" fill="${c.river}" opacity="${c.glow}" filter="url(#glow)"/>` : ''}
<path d="${ribbon}" fill="${c.river}"/>
</g>
<path class="flow" d="${centerD}" pathLength="100" fill="none" stroke="${c.flow}" stroke-width="1.1" stroke-linecap="round"/>
${riverName}
${ticks.join('')}
${cities}
${out.join('')}
${intro}
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="6" fill="none" stroke="${c.border}"/>`;

  const style = `
text{font-family:${FONT};fill:${c.text}}
.t1{font-size:13px;font-weight:600}
.body{font-size:13px;fill:${c.text2}}
.small{font-size:11.5px;fill:${c.text2}}
.lbl{font-size:10.5px;font-weight:600;letter-spacing:.06em;fill:${c.text3}}
.tick{font-size:10px;fill:${c.text3};font-variant-numeric:tabular-nums}
.foot{font-size:10.5px;fill:${c.text3}}
.anno{font-size:12px;font-weight:600}
.city{font-size:11.5px;fill:${c.text2}}
.home{font-weight:600;fill:${c.text}}
.sea{font-size:10.5px;font-style:italic;letter-spacing:.12em;fill:${c.text3}}
.river{font-size:10px;font-style:italic;letter-spacing:.08em;fill:${c.river}}
.halo{paint-order:stroke;stroke:${c.panel};stroke-width:3px;stroke-linejoin:round}
.intro{animation:in .9s ease-out both}
.unroll{transform-box:fill-box;transform-origin:0 50%;animation:unroll ${REVEAL_DUR}s linear ${REVEAL_START}s both}
@keyframes unroll{from{transform:scaleX(0)}}
.in{animation:in .8s ease-out both}
.pop{animation:in .5s ease-out both}
@keyframes in{from{opacity:0}}
.outline{animation:draw 2.2s cubic-bezier(.45,0,.2,1) .1s both}
@keyframes draw{from{stroke-dasharray:100 100;stroke-dashoffset:100}to{stroke-dasharray:100 100;stroke-dashoffset:0}}
.reveal{stroke-dasharray:100 200;animation:reveal ${REVEAL_DUR}s linear ${REVEAL_START}s both}
@keyframes reveal{from{stroke-dashoffset:100}}
.flow{stroke-dasharray:.3 1.7;opacity:.85;animation:flow 1.6s linear infinite,fadein 1s ease-out ${r(REVEAL_START + REVEAL_DUR)}s both}
@keyframes flow{to{stroke-dashoffset:-2}}
@keyframes fadein{from{opacity:0}}
.pulse{opacity:0;transform-box:fill-box;transform-origin:center;animation:pulse 2.4s ease-out infinite}
@keyframes pulse{0%{opacity:.7;transform:scale(1)}80%,100%{opacity:0;transform:scale(3.4)}}`;

  return svgDoc({
    width: W,
    height: H,
    title: `The year as the ${preset.label}`,
    desc: `A map with the ${preset.label} drawn as the last 12 months of GitHub activity: it flows from its source (a year ago) to its mouth (this week), and its width is the number of contributions each week. ${fmt(total)} contributions in total; the busiest week, ${weekRange(weeks[peak])}, had ${fmt(peakVal)}.`,
    style,
    body,
  });
}
