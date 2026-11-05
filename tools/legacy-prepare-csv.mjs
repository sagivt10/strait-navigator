#!/usr/bin/env node
// Offline CSV preparation and optional review SQL. Does not execute SQL or use network.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { prepareLegacy } from './legacy-prepare.mjs';
export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const records = []; let row = [], value = '', quoted = false, closed = false;
  const cell = () => { row.push(value); value = ''; closed = false; };
  const line = () => { cell(); records.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i+1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } } else value += c; }
    else if (c === ',') cell();
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i+1] === '\n') i++; line(); }
    else if (closed) throw new Error('Unexpected character after closing CSV quote');
    else if (c === '"') { if (value) throw new Error('Unexpected CSV quote'); quoted = true; }
    else value += c;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (value || row.length || closed) line();
  if (!records.length) throw new Error('CSV has no header');
  const headers = records.shift();
  if (headers.some(h => !h) || new Set(headers).size !== headers.length) throw new Error('Empty or duplicate CSV header');
  return records.map((values, i) => {
    if (values.length !== headers.length) throw new Error(`CSV record ${i+2} has ${values.length} cells, expected ${headers.length}; no rows prepared`);
    return Object.fromEntries(headers.map((h,j) => [h, values[j]]));
  });
}
export function reviewSQL(normalized, report) {
  if (report.totals.rejected || report.reconciliation.changed_keys.length) throw new Error('Resolve rejected rows and changed existing keys before generating SQL');
  if (JSON.stringify(normalized.records).includes('$sn_legacy_import$')) throw new Error('Reserved SQL delimiter in source data');
  const rows = JSON.stringify(normalized.records).replaceAll("'", "''");
  return `-- PRIVATE: contains original legacy data. Review before running as database owner.\n-- Archive only; no verified leaderboard rows or old tables are changed.\nbegin;\nset local standard_conforming_strings = on;\nlock table public.sn_legacy_entries in share row exclusive mode;\ndo $sn_legacy_import$\ndeclare r jsonb; existing public.sn_legacy_entries;\nbegin\n for r in select value from jsonb_array_elements('${rows}'::jsonb) loop\n   select * into existing from public.sn_legacy_entries where import_key = r->>'import_key';\n   if found then\n     if existing.source is distinct from r->'source' or existing.normalized is distinct from r->'normalized' or existing.raw_json is distinct from r->>'raw_json' or existing.raw_sha256 is distinct from r->>'raw_sha256' or existing.verification <> 'legacy_unverified' or existing.verified_board_eligible then\n       raise exception 'Legacy source changed: %. No records in this transaction imported.', r->>'import_key';\n     end if;\n   else\n     insert into public.sn_legacy_entries(import_key, source, normalized, raw_json, raw_sha256)\n     values(r->>'import_key', r->'source', r->'normalized', r->>'raw_json', r->>'raw_sha256');\n   end if;\n end loop;\nend\n$sn_legacy_import$;\ncommit;\n`;
}
async function main(args) {
  const emitSQL = args.includes('--review-sql'); args = args.filter(a => a !== '--review-sql');
  if (args.length < 3 || args.length > 4) throw new Error('Usage: node tools/legacy-prepare-csv.mjs export.csv mapping.json NEW_PRIVATE_OUTPUT_DIR [previous-normalized.json] [--review-sql]');
  const [input, map, out, prior] = args;
  const csv = await readFile(input, 'utf8'), mapping = JSON.parse(await readFile(map, 'utf8'));
  const result = prepareLegacy(JSON.stringify(parseCSV(csv)), mapping, prior ? JSON.parse(await readFile(prior, 'utf8')) : null);
  result.report.original_csv_sha256 = createHash('sha256').update(csv).digest('hex');
  const sql = emitSQL ? reviewSQL(result.normalized, result.report) : null;
  // Prevent a raw value from terminating the fixed DO block, even inside its SQL string.
  if (sql && JSON.stringify(result.normalized.records).includes('$sn_legacy_import$')) throw new Error('Reserved SQL delimiter in source data; use JSON review and request a reviewed import');
  await mkdir(resolve(out), { recursive: false, mode: 0o700 });
  for (const [name, data] of Object.entries({ 'source-export.csv': csv, 'mapping.json': JSON.stringify(mapping,null,2), 'normalized.json': JSON.stringify(result.normalized,null,2), 'report.json': JSON.stringify(result.report,null,2), ...(sql ? {'review-import.sql':sql} : {}) })) await writeFile(join(out,name),data,{flag:'wx',mode:0o600});
  console.log(JSON.stringify({output:resolve(out),...result.report.totals,database_imported:false}));
  if (result.report.totals.rejected) process.exitCode=2;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2)).catch(e=>{console.error(`Preparation stopped: ${e.message}`);process.exitCode=1;});
