import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchGivatayimCandidates } from '../supabase/functions/_shared/givatayimMunicipality/connector.ts';
import { dedupeGivatayimCandidates, mapGivatayimRecord } from '../supabase/functions/_shared/givatayimMunicipality/mapping.ts';

const source = await fetchGivatayimCandidates({ horizonDays: 7 });
if (!source.sourceComplete) throw new Error(`Source incomplete: ${source.incompleteReason}`);
const candidates = dedupeGivatayimCandidates(source.records.flatMap((row) => { const mapped = mapGivatayimRecord(row); return mapped ? [mapped] : []; })).candidates;
const sql = 'select title,starts_at,location_name,latitude,longitude,provider,city_id from public.active_event_occurrences;';
const sqlFile = join(tmpdir(), `nestup-givatayim-read-${process.pid}.sql`);
writeFileSync(sqlFile, sql, { encoding: 'utf8', mode: 0o600 });
const query = process.platform === 'win32'
  ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d','/s','/c',`npx supabase@latest db query --linked --output json --file ${sqlFile}`], { encoding:'utf8', maxBuffer:10_000_000 })
  : spawnSync('npx', ['supabase@latest','db','query','--linked','--output','json','--file',sqlFile], { encoding:'utf8', maxBuffer:10_000_000 });
unlinkSync(sqlFile);
if (query.status !== 0) throw new Error(`Remote read failed: ${String(query.stderr ?? query.error ?? '').slice(0,300)}`);
const parsed = JSON.parse(query.stdout.slice(query.stdout.indexOf('{')));
const data = parsed.rows ?? [];
const matches = [];
for (const candidate of candidates) {
  for (const existing of data) {
    const titleEqual = normalize(candidate.title) === normalize(existing.title);
    const timeDelta = Math.abs(Date.parse(candidate.startTime) - Date.parse(existing.starts_at));
    const distance = meters(candidate.latitude, candidate.longitude, existing.latitude, existing.longitude);
    if (titleEqual && timeDelta <= 15 * 60_000 && distance <= 300) matches.push({ class: 'EXACT', candidate: candidate.title, existing: existing.title, provider: existing.provider, city: existing.city_id, timeDeltaMinutes: timeDelta / 60000, distanceMeters: Math.round(distance) });
    else if (similarity(normalize(candidate.title), normalize(existing.title)) >= 0.82 && timeDelta <= 60 * 60_000 && distance <= 500) matches.push({ class: 'PROBABLE', candidate: candidate.title, existing: existing.title, provider: existing.provider, city: existing.city_id, timeDeltaMinutes: Math.round(timeDelta / 60000), distanceMeters: Math.round(distance) });
  }
}
console.log(JSON.stringify({ sourceComplete: source.sourceComplete, fetched: source.rawCount, normalized: source.records.length, relevant: candidates.length, exact: matches.filter((row) => row.class === 'EXACT').length, probable: matches.filter((row) => row.class === 'PROBABLE').length, ambiguous: 0, distinct: candidates.length - new Set(matches.filter((row) => row.class === 'EXACT').map((row) => row.candidate)).size, matches }, null, 2));

function normalize(value) { return String(value ?? '').normalize('NFKC').replace(/[״“”'".,:;!?()\[\]{}–—-]/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('he'); }
function meters(a,b,c,d) { const r=6371000,p=Math.PI/180; const x=(d-b)*p*Math.cos((a+c)*p/2),y=(c-a)*p; return Math.sqrt(x*x+y*y)*r; }
function similarity(a,b) { const aa=new Set(a.split(' ')),bb=new Set(b.split(' ')); const intersection=[...aa].filter((x)=>bb.has(x)).length; return intersection/Math.max(aa.size,bb.size,1); }
