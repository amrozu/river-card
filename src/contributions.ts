import type { Day } from './lib.ts';

/**
 * Reads the public contribution calendar (no token needed). If "Private contributions"
 * is enabled in the user's profile settings, the counts include private repositories.
 */
export async function fetchDays(user: string): Promise<Day[]> {
  const res = await fetch(`https://github.com/users/${encodeURIComponent(user)}/contributions`);
  if (!res.ok) throw new Error(`GitHub returned ${res.status} for user "${user}"`);
  const html = await res.text();
  const cells = new Map<string, Day>();
  for (const m of html.matchAll(/<td([^>]*)>/g)) {
    const a = m[1];
    const date = a.match(/data-date="([^"]+)"/)?.[1];
    const id = a.match(/id="([^"]+)"/)?.[1];
    const level = a.match(/data-level="(\d)"/)?.[1];
    if (date && id && level) cells.set(id, { date, level: Number(level), count: 0 });
  }
  for (const m of html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const cell = cells.get(m[1]);
    const n = m[2].match(/^(\d[\d,]*) contribution/);
    if (cell) cell.count = n ? Number(n[1].replace(/,/g, '')) : 0;
  }
  const days = [...cells.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (days.length < 300) throw new Error(`Only ${days.length} days parsed — has GitHub changed the calendar markup?`);
  // the card works on whole weeks starting on Sunday, like GitHub's own calendar
  while (days.length && new Date(`${days[0].date}T00:00:00Z`).getUTCDay() !== 0) days.shift();
  return days;
}

/** Account creation date, for the "uptime" tile. */
export async function fetchSince(user: string): Promise<string> {
  const headers: Record<string, string> = { accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}`, { headers });
  if (!res.ok) throw new Error(`GitHub API returned ${res.status} for user "${user}"`);
  const json = (await res.json()) as { created_at: string };
  return json.created_at.slice(0, 10);
}
