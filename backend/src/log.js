import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { localPath } from './paths.js';

// Only explicitly selected fields are logged. Never pass provider error objects.
export function log(level, event, fields = {}) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...fields });
  console.log(line);
}

export async function recordStartupFailure(code) {
  log('error', 'startup_failed', { code });
  try {
    const directory = path.join(localPath, 'logs');
    await mkdir(directory, { recursive: true });
    // One bounded file per UTC day; only startup/fatal summaries, no request bodies.
    await appendFile(path.join(directory, `startup-${new Date().toISOString().slice(0, 10)}.jsonl`),
      JSON.stringify({ time: new Date().toISOString(), event: 'startup_failed', code }) + '\n');
  } catch { /* A diagnostic write failure must not create another unhandled error. */ }
}
