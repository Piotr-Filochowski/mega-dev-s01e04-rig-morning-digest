import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

// Temp runs dir per test; runs/ is read-only.
let dir = '';
function nightFile(night: string, lines: string[]): string {
  dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(join(dir, `${night}.jsonl`), lines.join('\n'));
  return dir;
}
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

describe('readNight', () => {
  it('reads the real night: 5 jobs, 1 bad line', () => {
    const { rows, badLines } = readNight('runs', '2026-10-28');
    expect(badLines).toBe(1);
    expect(rows.map((r) => [r.job, r.owner, r.runs, r.retries, r.lastStatus])).toEqual([
      ['digest/render', null, 1, 0, 'ok'],
      ['fixtures/refresh', 'rook', 4, 3, 'ok'],
      ['lane/sync', 'rook', 8, 1, 'ok'],
      ['notes/backup', 'lane-07', 1, 0, 'fail'],
      ['rig/rotate-logs', 'lane-07', 1, 0, 'ok'],
    ]);
    expect(rows.map((r) => [r.job, r.lastError])).toEqual([
      ['digest/render', null],
      ['fixtures/refresh', 'upstream 503'],
      ['lane/sync', 'lock held'],
      ['notes/backup', 'quota exceeded'],
      ['rig/rotate-logs', null],
    ]);
    const sync = rows.find((r) => r.job === 'lane/sync');
    expect(sync?.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(sync?.lastAt).toBe('2026-10-29T05:00:04+01:00');
  });

  it('keeps a row whose owner is null', () => {
    const runs = nightFile('2026-01-01', ['{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok","owner":null}']);
    expect(readNight(runs, '2026-01-01').rows).toEqual([
      {
        job: 'a',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-01-01T01:00:00+01:00',
        lastAt: '2026-01-01T01:00:00+01:00',
      },
    ]);
  });

  it('takes the last status by time, not by file order', () => {
    const runs = nightFile('2026-01-02', [
      '{"at":"2026-01-02T02:00:00+01:00","job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-01-02T01:00:00+01:00","job":"a","status":"fail","owner":"x","error":"boom"}',
    ]);
    const [row] = readNight(runs, '2026-01-02').rows;
    expect(row).toMatchObject({ lastStatus: 'ok', lastError: 'boom', firstAt: '2026-01-02T01:00:00+01:00' });
  });

  it('counts lines with a missing field or an unknown status as bad', () => {
    const runs = nightFile('2026-01-03', [
      '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"done","owner":"x"}',
      '{"at":"2026-01-03T01:00:00+01:00","status":"ok","owner":"x"}',
      'not json',
      '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
    ]);
    const night = readNight(runs, '2026-01-03');
    expect(night.badLines).toBe(3);
    expect(night.rows).toHaveLength(1);
  });

  it('returns no rows for an empty file', () => {
    const runs = nightFile('2026-01-04', []);
    expect(readNight(runs, '2026-01-04')).toEqual({ rows: [], badLines: 0 });
  });

  it('throws for a night with no file', () => {
    dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    expect(() => readNight(dir, '2026-01-05')).toThrow();
  });
});
