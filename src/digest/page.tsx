import type { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { lane } from '../lane.js';
import { Layout } from '../views/layout.js';
import { DigestPage } from '../views/digest.js';
import { readNight } from './read.js';
import type { Night } from './types.js';

export function registerDigestPage(app: Hono, config: RigConfig) {
  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    let data: Night;
    try {
      data = readNight(config.runsDir, night);
    } catch {
      return c.text('no digest for that night', 404);
    }
    return c.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <DigestPage night={night} data={data} />
      </Layout>,
    );
  });
}
