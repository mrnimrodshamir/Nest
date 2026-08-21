import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function linkedQuery(sql) {
  const directory = await mkdtemp(join(tmpdir(), 'nestup-operator-'));
  const file = join(directory, 'query.sql');
  try {
    await writeFile(file, sql, { encoding: 'utf8', mode: 0o600 });
    const executable = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'npx';
    const args = process.platform === 'win32'
      ? ['/d','/s','/c',`npx supabase@latest db query --linked --output json --file ${file}`]
      : ['supabase@latest','db','query','--linked','--output','json','--file',file];
    const result = spawnSync(executable, args, { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, shell: false });
    if (result.status !== 0) throw new Error(`Supabase query failed: ${String(result.error?.message ?? result.stderr ?? result.stdout ?? 'unknown').slice(0, 500)}`);
    const start = result.stdout.indexOf('{');
    if (start < 0) throw new Error('Supabase query returned no JSON');
    const payload = JSON.parse(result.stdout.slice(start));
    return payload.rows ?? [];
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function sqlJson(value) { return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`; }
