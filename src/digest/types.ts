export type DigestStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log. Times keep the offset from the log.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: DigestStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Night = {
  rows: DigestRow[];
  // Lines that did not parse: counted, never thrown.
  badLines: number;
};

// Reads runs/<night>.jsonl. Sync, like nightsOnDisk. Missing file: throws (caller maps to 404).
export type ReadNight = (runsDir: string, night: string) => Night;
