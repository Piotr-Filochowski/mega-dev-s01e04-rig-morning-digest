import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

// Temp runs dir per test; runs/ is read-only. No server: app.request() only.
let dir = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function appWith(night: string | null, lines: string[] = []) {
  if (night) writeFileSync(join(dir, `${night}.jsonl`), lines.join('\n'));
  return createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
}

const NIGHT = '2026-02-01';
const GOOD = [
  '{"at":"2026-02-01T01:00:00+01:00","job":"b/job","status":"ok","owner":"rook"}',
  '{"at":"2026-02-01T02:00:00+01:00","job":"a/job","status":"fail","owner":null,"error":"boom"}',
  '{"at":"2026-02-01T03:00:00+01:00","job":"c/job","status":"retry","owner":"lane-07"}',
];

describe('digest page route', () => {
  it('returns 200 and the jobs for a normal night', async () => {
    const res = await appWith(NIGHT, GOOD).request(`/digest/${NIGHT}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain(`digest ${NIGHT}`);
    expect(html).toContain('a/job');
    expect(html).toContain('boom');
    expect(html).not.toContain('could not be read');
  });

  it('returns 404 for a night with no file', async () => {
    const res = await appWith(null).request('/digest/2026-02-02');
    expect(res.status).toBe(404);
  });

  it('says "nothing ran" for an empty night', async () => {
    const res = await appWith(NIGHT, []).request(`/digest/${NIGHT}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('serves a night with a bad line and shows a notice', async () => {
    const res = await appWith(NIGHT, [...GOOD, 'not json']).request(`/digest/${NIGHT}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 line in the log could not be read');
    expect(html).toContain('a/job');
  });
});

describe('digest JSON route', () => {
  it('returns 200 and the rows for a normal night', async () => {
    const res = await appWith(NIGHT, GOOD).request(`/api/digest/${NIGHT}`);
    const body = (await res.json()) as { night: string; rows: DigestRow[]; badLines: number };
    expect(res.status).toBe(200);
    expect(body.night).toBe(NIGHT);
    expect(body.badLines).toBe(0);
    expect(body.rows).toHaveLength(3);
    expect(body.rows[0]).toMatchObject({ job: 'a/job', owner: null, lastStatus: 'fail', lastError: 'boom' });
  });

  it('returns 404 for a night with no file', async () => {
    const res = await appWith(null).request('/api/digest/2026-02-02');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ night: '2026-02-02' });
  });

  it('returns rows: [] for an empty night', async () => {
    const res = await appWith(NIGHT, []).request(`/api/digest/${NIGHT}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: NIGHT, rows: [], badLines: 0 });
  });

  it('serves a night with a bad line and reports badLines: 1', async () => {
    const res = await appWith(NIGHT, [...GOOD, 'not json']).request(`/api/digest/${NIGHT}`);
    const body = (await res.json()) as { rows: DigestRow[]; badLines: number };
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(3);
  });
});

describe('page and JSON agree (ADR 0001)', () => {
  it('list the same jobs in the same order', async () => {
    const app = appWith(NIGHT, GOOD);
    const body = (await (await app.request(`/api/digest/${NIGHT}`)).json()) as { rows: DigestRow[] };
    const html = await (await app.request(`/digest/${NIGHT}`)).text();
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual(['a/job', 'b/job', 'c/job']);
    const positions = jobs.map((j) => html.indexOf(`<td>${j}</td>`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
