#!/usr/bin/env node
// Usage: node src/cli.ts --user <login> --name "Full Name" --role "Role" [--river wisla] [--company X] [--city Y] [--out dir]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Day, type Theme, profile } from './lib.ts';
import { renderStatus } from './status.ts';
import { renderRiver } from './river.ts';
import { PRESETS } from './presets.ts';
import { fetchDays, fetchSince } from './contributions.ts';

const args = new Map<string, string>();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) args.set(argv[i].replace(/^--/, ''), argv[i + 1] ?? '');

const user = args.get('user');
if (!user) {
  console.error('Missing --user <github-login>');
  process.exit(1);
}
profile.name = args.get('name') || user;
profile.role = args.get('role') || 'Developer';
profile.company = args.get('company') ?? '';
profile.city = args.get('city') ?? '';
const out = args.get('out') || 'river-card';
const riverId = (args.get('river') || 'wisla').toLowerCase();
const preset = PRESETS.find((p) => p.id === riverId);
if (!preset) {
  console.error(`Unknown --river "${riverId}". Available: ${PRESETS.map((p) => p.id).join(', ')}`);
  process.exit(1);
}

const days: Day[] = args.get('data') ? JSON.parse(readFileSync(args.get('data')!, 'utf8')) : await fetchDays(user);
profile.githubSince = args.get('since') || (await fetchSince(user));

const geo = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'rivers', `${preset.id}.json`);
mkdirSync(out, { recursive: true });
for (const theme of ['light', 'dark'] as Theme[]) {
  const map = renderRiver(days, theme, preset, geo);
  writeFileSync(join(out, `river-${theme}.svg`), renderStatus(days, theme, { middle: { svg: map, height: 500 }, components: false }));
}
console.log(`river-card (${preset.id}): ${days.length} days, ${days.reduce((s, d) => s + d.count, 0)} contributions → ${out}/river-{light,dark}.svg`);
