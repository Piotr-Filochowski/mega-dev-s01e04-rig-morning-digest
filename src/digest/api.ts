import type { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { readNight } from './read.js';
import type { Night } from './types.js';

// GET /api/digest/:night: the page's rows as JSON. Same readNight output, no second code path (ADR 0001).
export function registerDigestApi(app: Hono, config: RigConfig) {
  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    let data: Night;
    try {
      data = readNight(config.runsDir, night);
    } catch {
      return c.json({ error: 'no digest for that night', night }, 404);
    }
    return c.json({ night, rows: data.rows, badLines: data.badLines });
  });
}
