#!/usr/bin/env node
// Local preparation only. Never connects to Supabase or executes SQL.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const hash = text => createHash('sha256').update(text).digest('hex');
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const fail = message => { throw new Error(message); };
const allowedFields = ['name', 'score', 'time', 'health', 'status', 'version', 'submitted_at'];

// Validate JSON structurally, reject duplicate object keys, and retain exact row slices.
// A duplicate JSON key could otherwise silently replace an original value in JSON.parse.
function splitRows(text) {
  let p = 0;
  const ws = () => { while (/\s/.test(text[p] || '') && p < text.length) p++; };
  function string() {
    const start = p++;
    while (p < text.length) {
      if (text[p] === '\\') { p += 2; continue; }
      if (text[p++] === '"') return JSON.parse(text.slice(start, p));
    }
    fail('Unterminated JSON string');
  }
  function value() {
    ws();
    if (text[p] === '"') { string(); return; }
    if (text[p] === '{' || text[p] === '[') {
      const isObject = text[p++] === '{'; const end = isObject ? '}' : ']'; const keys = new Set();
      ws(); if (text[p] === end) { p++; return; }
      while (p < text.length) {
        if (isObject) {
          if (text[p] !== '"') fail('Expected JSON object key');
          const key = string(); if (keys.has(key)) fail(`Duplicate JSON object key: ${key}`); keys.add(key);
          ws(); if (text[p++] !== ':') fail('Expected colon');
        }
        value(); ws(); if (text[p] === end) { p++; return; }
        if (text[p++] !== ',') fail('Expected comma'); ws();
      }
      fail('Unterminated JSON container');
    }
    const token = /^(?:null|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(p));
    if (!token) fail('Invalid JSON value'); p += token[0].length;
  }
  // Standard parser first rejects invalid whitespace, escapes, and trailing data.
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) fail('Export must be a top-level JSON array, one object per source row');
  ws(); if (text[p++] !== '[') fail('Expected array'); ws(); const slices = [];
  if (text[p] === ']') return slices;
  while (p < text.length) {
    const start = p; value(); slices.push(text.slice(start, p)); ws();
    if (text[p++] === ']') break; ws();
  }
  return slices;
}

// Preserve numeric lexemes for mapped values before JS floating-point conversion.
// The raw export remains byte-for-byte retained even for unmapped nested fields.
function exactNumbers(text) {
  let result = ''; let quoted = false;
  for (let i = 0; i < text.length;) {
    const ch = text[i];
    if (quoted) {
      result += ch; i++;
      if (ch === '\\') { result += text[i++]; continue; }
      if (ch === '"') quoted = false;
    } else if (ch === '"') { quoted = true; result += ch; i++; }
    else if (ch === '-' || /[0-9]/.test(ch)) {
      const token = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i))[0];
      result += JSON.stringify(token); i += token.length;
    } else { result += ch; i++; }
  }
  return JSON.parse(result);
}

function checkMapping(mapping) {
  if (!object(mapping) || mapping.mapping_version !== 1) fail('mapping_version must be 1');
  for (const field of ['project', 'schema', 'table']) {
    if (typeof mapping.source?.[field] !== 'string' || !mapping.source[field].trim()) fail(`source.${field} is required`);
  }
  if (!Array.isArray(mapping.primary_key) || !mapping.primary_key.length) fail('primary_key must list the actual source PK columns');
  const keys = new Set();
  for (const key of mapping.primary_key) {
    if (!object(key) || typeof key.column !== 'string' || !key.column || !['string', 'integer'].includes(key.type) || keys.has(key.column)) fail('Each PK needs a unique column and type string or integer');
    keys.add(key.column);
  }
  if (!object(mapping.fields)) fail('fields is required');
  for (const field of Object.keys(mapping.fields)) if (!allowedFields.includes(field)) fail(`Unknown target field: ${field}`);
  for (const field of allowedFields) {
    const spec = mapping.fields[field];
    const column = object(spec) ? spec.column : spec;
    if (object(spec) && !['ms_to_seconds', 'postgres_timestamp_to_rfc3339'].includes(spec.transform)) fail(`Unknown transform for ${field}`);
    if (object(spec) && ((spec.transform === 'ms_to_seconds' && field !== 'time') || (spec.transform === 'postgres_timestamp_to_rfc3339' && field !== 'submitted_at'))) fail('Transform not allowed for this field');
    if (column !== undefined && column !== null && (typeof column !== 'string' || !column)) fail(`Invalid mapping for ${field}`);
  }
  for (const field of ['name', 'score']) if (typeof mapping.fields[field] !== 'string') fail(`Explicit ${field} mapping is required`);
}
function identityValue(value, type) {
  if (type === 'string') {
    if (typeof value !== 'string' || !value.trim()) fail('String source PK is missing, empty, or not a string');
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) fail('Numeric source PK is unsafe; re-export bigint IDs as JSON strings');
    return String(value);
  }
  if (typeof value === 'string' && /^-?(0|[1-9]\d*)$/.test(value)) return BigInt(value).toString();
  fail('Integer source PK must be an exact integer or a decimal string');
}
function numeric(v, field, integer) {
  if (typeof v === 'string' && (integer ? /^-?(?:0|[1-9]\d*)$/ : /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/).test(v)) v = Number(v);
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER || (integer && !Number.isSafeInteger(v))) fail(`${field} must be a finite ${integer ? 'safe integer' : 'number'}`);
  return v;
}

export function prepareLegacy(exportText, mapping, previous = null) {
  checkMapping(mapping);
  const rawRows = splitRows(exportText);
  const candidates = []; const rejected = []; const identityGroups = new Map();
  rawRows.forEach((rawJson, rowIndex) => {
    const row = JSON.parse(rawJson); const exact = exactNumbers(rawJson); let importKey = null;
    try {
      if (!object(row)) fail('Row must be a JSON object');
      const identity = mapping.primary_key.map(({ column, type }) => {
        if (!own(row, column)) fail(`Missing PK column: ${column}`);
        if (type === 'string' && typeof row[column] !== 'string') fail(`PK ${column} requires a string; review mapping type`);
        return { column, type, value: identityValue(typeof row[column] === 'number' ? exact[column] : row[column], type) };
      });
      importKey = `legacy_${hash(JSON.stringify([mapping.source.project, mapping.source.schema, mapping.source.table, identity]))}`;
      const indices = identityGroups.get(importKey) || []; indices.push(rowIndex); identityGroups.set(importKey, indices);
      const fields = {};
      for (const field of allowedFields) {
        const spec = mapping.fields[field]; const column = object(spec) ? spec.column : spec;
        if (column == null) { fields[field] = null; continue; }
        if (!own(row, column)) fail(`Mapped column is absent: ${column} (${field}); use null in mapping for unknown fields`);
        fields[field] = typeof row[column] === 'number' ? exact[column] : row[column];
        if (typeof row[column] === 'number' && !['score', 'time', 'health'].includes(field)) fail(`${field} must be exported as a string`);
        if (fields[field] !== null && spec?.transform === 'ms_to_seconds') fields[field] = numeric(fields[field], 'time_ms', true) / 1000;
        if (fields[field] !== null && spec?.transform === 'postgres_timestamp_to_rfc3339') {
          if (typeof fields[field] !== 'string') fail('Source timestamp must be a string');
          fields[field] = fields[field].replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00');
        }
      }
      if (typeof fields.name !== 'string' || !fields.name.trim() || [...fields.name].length > 1000 || /[\u0000-\u001f\u007f]/.test(fields.name)) fail('name must be a nonempty string without control characters, at most 1000 characters');
      fields.score = numeric(fields.score, 'score', true);
      for (const f of ['time', 'health']) if (fields[f] !== null) { fields[f] = numeric(fields[f], f, f === 'health'); if (fields[f] < 0) fail(`${f} cannot be negative`); }
      for (const f of ['status', 'version']) if (fields[f] !== null && (typeof fields[f] !== 'string' || !fields[f].trim())) fail(`${f} must be null or a nonempty string`);
      if (fields.submitted_at !== null && (typeof fields.submitted_at !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(fields.submitted_at) || !Number.isFinite(Date.parse(fields.submitted_at)))) fail('submitted_at must be null or an RFC3339 timestamp with timezone');
      candidates.push({ row_index: rowIndex, import_key: importKey, source: { ...mapping.source, primary_key: identity }, verification: 'legacy_unverified', verified_board_eligible: false, normalized: fields, raw_json: rawJson, raw_sha256: hash(rawJson) });
    } catch (error) { rejected.push({ row_index: rowIndex, import_key: importKey, reason: error.message, raw_json: rawJson }); }
  });
  const duplicateGroups = [...identityGroups].filter(([, indices]) => indices.length > 1).map(([import_key, row_indices]) => ({ import_key, row_indices }));
  const duplicateKeys = new Set(duplicateGroups.map(g => g.import_key));
  const accepted = candidates.filter(record => {
    if (!duplicateKeys.has(record.import_key)) return true;
    rejected.push({ row_index: record.row_index, import_key: record.import_key, reason: 'Duplicate source PK / import-key collision: all copies rejected', raw_json: record.raw_json }); return false;
  });
  const previousByKey = new Map();
  if (previous !== null) {
    if (!object(previous) || previous.format !== 'sn-legacy-preparation-v1' || !Array.isArray(previous.records)) fail('Previous file must be a normalized preparation output');
    for (const record of previous.records) {
      if (!record?.import_key || previousByKey.has(record.import_key) || typeof record.raw_json !== 'string' || hash(record.raw_json) !== record.raw_sha256) fail('Previous preparation has duplicate keys or invalid raw row hashes');
      previousByKey.set(record.import_key, record);
    }
  }
  const currentKeys = new Set(accepted.map(r => r.import_key));
  const reconciliation = { new_keys: [], unchanged_keys: [], changed_keys: [], missing_previous_keys: [...previousByKey.keys()].filter(k => !currentKeys.has(k)) };
  for (const record of accepted) {
    const old = previousByKey.get(record.import_key);
    // Different raw formatting also requires review. Nothing is silently overwritten.
    if (!old) reconciliation.new_keys.push(record.import_key);
    else if (old.raw_sha256 === record.raw_sha256 && JSON.stringify(old.normalized) === JSON.stringify(record.normalized)) reconciliation.unchanged_keys.push(record.import_key);
    else reconciliation.changed_keys.push(record.import_key);
  }
  const report = { format: 'sn-legacy-review-v1', source: mapping.source, export_sha256: hash(exportText), mapping_sha256: hash(JSON.stringify(mapping)), totals: { input: rawRows.length, accepted: accepted.length, rejected: rejected.length, duplicate_groups: duplicateGroups.length }, ready_for_mapping_review: rejected.length === 0, ready_for_database_import: false, duplicate_groups: duplicateGroups, reconciliation, rejected: rejected.sort((a,b) => a.row_index-b.row_index), warnings: ['Preparation only: no database import has occurred.', 'Legacy records are unverified and must not enter the verified v20 leaderboard.', 'Original JSON is retained verbatim; protect files as private backups.', 'Missing previous keys are review items, never deletion instructions.'] };
  return { normalized: { format: 'sn-legacy-preparation-v1', source: mapping.source, records: accepted }, report };
}

async function main(args) {
  if (args.length < 3 || args.length > 4) fail('Usage: node tools/legacy-prepare.mjs export.json mapping.json NEW_OUTPUT_DIRECTORY [previous-normalized.json]');
  const [exportPath, mappingPath, outPath, previousPath] = args;
  const text = await readFile(exportPath, 'utf8'); const mapping = JSON.parse(await readFile(mappingPath, 'utf8'));
  const previous = previousPath ? JSON.parse(await readFile(previousPath, 'utf8')) : null;
  const result = prepareLegacy(text, mapping, previous);
  // A new directory avoids overwriting any backup, input, or previous review.
  await mkdir(resolve(outPath), { recursive: false, mode: 0o700 });
  await writeFile(join(outPath, 'source-export.json'), text, { flag: 'wx', mode: 0o600 });
  await writeFile(join(outPath, 'mapping.json'), JSON.stringify(mapping, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await writeFile(join(outPath, 'normalized.json'), JSON.stringify(result.normalized, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await writeFile(join(outPath, 'report.json'), JSON.stringify(result.report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ output: resolve(outPath), ...result.report.totals, database_imported: false }));
  if (result.report.totals.rejected) process.exitCode = 2;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2)).catch(error => { console.error(`Preparation stopped: ${error.message}`); process.exitCode = 1; });
