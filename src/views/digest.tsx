import type { Night } from '../digest/types.js';

// Marks are words, not colour alone: "many retries" and "FAIL" are in the text of the cell.
const RETRY_MARK = 3;

export function DigestPage({ night, data }: { night: string; data: Night }) {
  return (
    <>
      <h1>digest {night}</h1>
      {data.badLines > 0 && (
        <p class="warn">
          {data.badLines} {data.badLines === 1 ? 'line' : 'lines'} in the log could not be read.
        </p>
      )}
      {data.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr>
                <td>{r.job}</td>
                <td>{r.owner ?? '—'}</td>
                <td>{r.runs}</td>
                <td>
                  {r.retries >= RETRY_MARK ? (
                    <span class="warn">{r.retries} (many retries)</span>
                  ) : (
                    r.retries
                  )}
                </td>
                <td>{r.lastStatus === 'fail' ? <strong class="warn">FAIL</strong> : r.lastStatus}</td>
                <td>{r.lastError ?? '—'}</td>
                <td>{r.firstAt}</td>
                <td>{r.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
