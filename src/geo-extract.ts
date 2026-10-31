// One-off: cuts what each preset needs out of Natural Earth 10m and writes data/rivers/<id>.json.
// Usage: node src/geo-extract.ts <ne_10m_rivers_lake_centerlines.geojson> <ne_10m_admin_0_countries.geojson>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PRESETS, type LonLat } from './presets.ts';

type Pt = LonLat;
type Box = [number, number, number, number];

const [riversPath, countriesPath] = process.argv.slice(2);
const rivers = JSON.parse(readFileSync(riversPath, 'utf8')).features;
const countries = JSON.parse(readFileSync(countriesPath, 'utf8')).features;

const lines = (g: any): Pt[][] => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []);
const rings = (g: any): Pt[][] =>
  g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p: Pt[][]) => p[0]) : [];
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const bboxOf = (pts: Pt[]): Box => [
  Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])),
  Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1])),
];
const area = (r: Pt[]) => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
const overlaps = (a: Box, b: Box) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const pad = (b: Box, f: number): Box => { const w = b[2] - b[0], h = b[3] - b[1]; return [b[0] - w * f, b[1] - h * f, b[2] + w * f, b[3] + h * f]; };

function simplify(line: Pt[], tol: number): Pt[] {
  if (line.length < 3) return line;
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = line[a], [bx, by] = line[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-12;
    let maxD = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (line[i][0] - ax) - dx * (line[i][1] - ay)) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return line.filter((_, i) => keep[i]);
}
function simplifyRing(ring: Pt[], tol: number): Pt[] {
  if (ring.length < 4) return ring;
  const far = ring.reduce((m, p, i) => (dist(p, ring[0]) > dist(ring[m], ring[0]) ? i : m), 0);
  return simplify(ring.slice(0, far + 1), tol).concat(simplify(ring.slice(far), tol).slice(1));
}
/** Sutherland–Hodgman: polygon clipped to an axis-aligned box. */
function clipRing(ring: Pt[], b: Box): Pt[] {
  let out = ring;
  const edges: [(p: Pt) => boolean, (p: Pt, q: Pt) => Pt][] = [
    [(p) => p[0] >= b[0], (p, q) => [b[0], p[1] + ((q[1] - p[1]) * (b[0] - p[0])) / (q[0] - p[0])]],
    [(p) => p[0] <= b[2], (p, q) => [b[2], p[1] + ((q[1] - p[1]) * (b[2] - p[0])) / (q[0] - p[0])]],
    [(p) => p[1] >= b[1], (p, q) => [p[0] + ((q[0] - p[0]) * (b[1] - p[1])) / (q[1] - p[1]), b[1]]],
    [(p) => p[1] <= b[3], (p, q) => [p[0] + ((q[0] - p[0]) * (b[3] - p[1])) / (q[1] - p[1]), b[3]]],
  ];
  for (const [inside, cut] of edges) {
    const inp = out;
    out = [];
    for (let i = 0; i < inp.length; i++) {
      const p = inp[i], q = inp[(i + 1) % inp.length];
      if (inside(q)) { if (!inside(p)) out.push(cut(p, q)); out.push(q); }
      else if (inside(p)) out.push(cut(p, q));
    }
    if (!out.length) break;
  }
  return out;
}
const round = (l: Pt[]): Pt[] => l.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);

mkdirSync('data/rivers', { recursive: true });
for (const p of PRESETS) {
  // ── river: chain all parts from the endpoint nearest the source ──
  const names = Array.isArray(p.ne) ? p.ne : [p.ne];
  const pool: Pt[][] = rivers.filter((f: any) => names.includes(f.properties.name)).flatMap((f: any) => lines(f.geometry)).map((l: Pt[]) => [...l]);
  if (!pool.length) throw new Error(`No river "${p.ne}" in Natural Earth`);
  let cursor = pool.flatMap((l) => [l[0], l[l.length - 1]]).reduce((m, q) => (dist(q, p.source) < dist(m, p.source) ? q : m));
  let chain: Pt[] = [];
  while (pool.length) {
    let best = 0, bestD = Infinity, flip = false;
    pool.forEach((l, i) => {
      const d0 = dist(cursor, l[0]), d1 = dist(cursor, l[l.length - 1]);
      if (d0 < bestD) { bestD = d0; best = i; flip = false; }
      if (d1 < bestD) { bestD = d1; best = i; flip = true; }
    });
    if (chain.length && bestD > 0.3) break; // the rest is a separate branch
    const seg = pool.splice(best, 1)[0];
    if (flip) seg.reverse();
    chain = chain.concat(chain.length ? seg.slice(1) : seg);
    cursor = chain[chain.length - 1];
  }
  if (p.cutFrom) {
    const i = chain.reduce((m, q, k) => (dist(q, p.cutFrom!) < dist(chain[m], p.cutFrom!) ? k : m), 0);
    chain = chain.slice(i);
  }

  // ── country: main ring + rings near it (islands), no overseas territories ──
  const country = countries.find((f: any) => f.properties.ADM0_A3 === p.country);
  const all = rings(country.geometry);
  const main = all.reduce((m, r) => (area(r) > area(m) ? r : m));
  const near = pad(bboxOf(main), 0.3);
  const within = (a: Box, b: Box) => a[0] >= b[0] && a[1] >= b[1] && a[2] <= b[2] && a[3] <= b[3];
  let home = all.filter((r) => within(bboxOf(r), near) && area(r) > area(main) * 0.002);

  const hb = bboxOf(home.flat());
  const rb = bboxOf(chain);
  const extent: Box = p.extent ?? pad([Math.min(hb[0], rb[0]), Math.min(hb[1], rb[1]), Math.max(hb[2], rb[2]), Math.max(hb[3], rb[3])], 0.03);
  const clipBox = pad(extent, p.extent ? 0.8 : 0.25);
  const span = extent[2] - extent[0];

  home = home.filter((r) => overlaps(bboxOf(r), clipBox)).map((r) => clipRing(r, clipBox)).filter((r) => r.length > 3);
  const neighbours: Pt[][] = countries
    .filter((f: any) => f.properties.ADM0_A3 !== p.country)
    .flatMap((f: any) => rings(f.geometry))
    .filter((r: Pt[]) => overlaps(bboxOf(r), clipBox))
    .map((r: Pt[]) => clipRing(r, clipBox))
    .filter((r: Pt[]) => r.length > 3 && area(r) > (extent[2] - extent[0]) * (extent[3] - extent[1]) * 0.0004);
  const context: Pt[][] = rivers
    .filter((f: any) => !names.includes(f.properties.name) && (f.properties.scalerank ?? 99) <= 9)
    .flatMap((f: any) => lines(f.geometry))
    .flatMap((l: Pt[]) => {
      const runs: Pt[][] = [];
      let cur: Pt[] = [];
      for (const q of l) {
        if (q[0] >= clipBox[0] && q[0] <= clipBox[2] && q[1] >= clipBox[1] && q[1] <= clipBox[3]) cur.push(q);
        else if (cur.length) { runs.push(cur); cur = []; }
      }
      if (cur.length) runs.push(cur);
      return runs.filter((r) => r.length > 1);
    });

  const data = {
    source: 'Natural Earth 10m (public domain)',
    extent,
    home: home.map((r) => round(simplifyRing(r, span / 2200))),
    neighbours: neighbours.map((r) => round(simplifyRing(r, span / 1200))),
    river: round(simplify(chain, span / 4000)),
    context: context.map((l) => round(simplify(l, span / 1800))).filter((l) => l.length > 1),
  };
  writeFileSync(`data/rivers/${p.id}.json`, JSON.stringify(data));
  console.log(`${p.id.padEnd(12)} river ${String(data.river.length).padStart(4)} pts  ${chain[0].map((v) => v.toFixed(1))} → ${chain[chain.length - 1].map((v) => v.toFixed(1))}  home rings ${data.home.length}  ${(JSON.stringify(data).length / 1024).toFixed(0)} KB`);
}
