import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, ReadNight } from './types.js';

type Line = { at: string; ms: number; job: string; status: DigestStatus; owner: string | null; error: string | null };

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

// One log line, or null if it doesn't parse or lacks a field. `at` must be a real time.
function parseLine(text: string): Line | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const { at, job, status, owner, error } = o;
  if (typeof at !== 'string' || typeof job !== 'string' || job === '') return null;
  if (typeof status !== 'string' || !STATUSES.includes(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && error !== null && typeof error !== 'string') return null;
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) return null;
  return { at, ms, job, status: status as DigestStatus, owner, error: error ?? null };
}

// Night = YYYY-MM-DD, so the file name can't leave runsDir. Anything else throws, like a missing file.
export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) throw new Error(`not a night: ${night}`);
  const text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');

  const byJob = new Map<string, Line[]>();
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue; // trailing newline, blank lines: not lines
    const line = parseLine(raw);
    if (!line) {
      badLines++;
      continue;
    }
    const lines = byJob.get(line.job) ?? [];
    lines.push(line);
    byJob.set(line.job, lines);
  }

  const rows: DigestRow[] = [...byJob].map(([job, lines]) => {
    // Order by time, not file position; same instant keeps file order (sort is stable).
    const sorted = [...lines].sort((a, b) => a.ms - b.ms);
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    return {
      job,
      owner: last.owner,
      runs: lines.length,
      retries: lines.filter((l) => l.status === 'retry').length,
      lastStatus: last.status,
      // Most recent error seen that night, even if a later run went ok.
      lastError: sorted.findLast((l) => l.error !== null)?.error ?? null,
      firstAt: first.at,
      lastAt: last.at,
    };
  });
  rows.sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines };
};
