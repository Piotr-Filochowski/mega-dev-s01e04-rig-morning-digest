import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import type { DigestStatus } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightLink[];
};

export type Counts = Record<DigestStatus, number>;

// A night on disk and its counts; counts is null when the night's file can't be read.
export type NightLink = { night: string; counts: Counts | null };

// Counts log lines by their status: ok + retry + fail = the night's job runs (the sum of `runs`
// over the digest rows). readNight only keeps the last status per job, so the split by status is
// read here, but readNight stays the judge of which lines are valid: if the two totals disagree,
// or the file can't be read, there are no counts rather than wrong ones.
export function nightCounts(runsDir: string, night: string): Counts | null {
  try {
    const runs = readNight(runsDir, night).rows.reduce((sum, r) => sum + r.runs, 0);
    const counts: Counts = { ok: 0, retry: 0, fail: 0 };
    for (const raw of readFileSync(join(runsDir, `${night}.jsonl`), 'utf8').split('\n')) {
      try {
        const status: unknown = (JSON.parse(raw) as { status?: unknown } | null)?.status;
        if (status === 'ok' || status === 'retry' || status === 'fail') counts[status]++;
      } catch {
        // blank or unparsable line: not counted
      }
    }
    return counts.ok + counts.retry + counts.fail === runs ? counts : null;
  } catch {
    return null;
  }
}

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => ({ night, counts: nightCounts(config.runsDir, night) })),
  };
}
