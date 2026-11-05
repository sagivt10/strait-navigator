import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareLegacy } from './legacy-prepare.mjs';
import { parseCSV, reviewSQL } from './legacy-prepare-csv.mjs';
const mapping = {mapping_version:1,source:{project:'test',schema:'public',table:'scores'},primary_key:[{column:'id',type:'string'}],fields:{name:'name',score:'score',time:null,health:null,status:null,version:null,submitted_at:null}};
const row = {id:'one',name:'A',score:123,old_extra:{deaths:5}};
const prepare = (rows,m=mapping,old=null) => prepareLegacy(JSON.stringify(rows),m,old);
test('raw values preserved and unknowns null; never verified',()=>{
 const text='[ { "id":"one", "name":"A", "score":123, "extra":900719925474099312345 } ]';
 const r=prepareLegacy(text,mapping); assert.equal(r.report.totals.accepted,1);
 const record=r.normalized.records[0]; assert.match(record.raw_json,/900719925474099312345/);
 assert.equal(record.normalized.health,null);assert.equal(record.normalized.status,null);assert.equal(record.normalized.time,null);assert.equal(record.normalized.version,null);
 assert.equal(record.verification,'legacy_unverified');assert.equal(record.verified_board_eligible,false);
});
test('unsafe and fractional scores rejected without raw loss',()=>{
 for(const score of ['9007199254740993','9007199254740991.1','1.000000000000000001','1e400','null','true','""']){
 const r=prepareLegacy(`[{"id":"one","name":"A","score":${score}}]`,mapping);
 assert.equal(r.report.totals.rejected,1,score);assert.match(r.report.rejected[0].raw_json,/score/);
 }
});
test('duplicate source IDs reject every copy, including malformed copy',()=>{
 const r=prepare([row,{...row,score:null},{...row,score:4}]);assert.equal(r.report.totals.accepted,0);assert.equal(r.report.totals.rejected,3);assert.equal(r.report.totals.duplicate_groups,1);
});
test('malformed rows counted and strict mapping never silently loses fields',()=>{
 const r=prepare([row,null,[],{id:'two',name:'',score:2},{id:'three',name:'B'}]);assert.deepEqual(r.report.totals,{input:5,accepted:1,rejected:4,duplicate_groups:0});
 assert.throws(()=>prepare([row],{...mapping,fields:{...mapping.fields,scroe:'score'}}),/Unknown/);
 const missing=prepare([row],{...mapping,fields:{...mapping.fields,time:'unknown'}});assert.equal(missing.report.totals.rejected,1);
});
test('duplicate JSON properties and malformed JSON reject entire export',()=>{
 assert.throws(()=>prepareLegacy('[{"id":"a","id":"b","name":"A","score":2}]',mapping),/Duplicate/);
 assert.throws(()=>prepareLegacy('[{"id":}]',mapping));
 assert.throws(()=>prepareLegacy('{}',mapping),/array/);
});
test('source table/project identity prevents cross-source collisions',()=>{
 const a=prepare([row]).normalized.records[0];const b=prepare([row],{...mapping,source:{...mapping.source,table:'daily_scores'}}).normalized.records[0];assert.notEqual(a.import_key,b.import_key);
 assert.equal(a.import_key,prepare([row]).normalized.records[0].import_key);
});
test('integer PK exact bigints and canonical decimal identity',()=>{
 const m={...mapping,primary_key:[{column:'id',type:'integer'}]};
 const a=prepareLegacy('[{"id":900719925474099312345,"name":"A","score":1}]',m);
 assert.equal(a.normalized.records[0].source.primary_key[0].value,'900719925474099312345');
 const b=prepare([{id:'900719925474099312345',name:'A',score:1}],m);assert.equal(a.normalized.records[0].import_key,b.normalized.records[0].import_key);
});
test('catch-up classifies new, unchanged, changed, missing without deleting',()=>{
 const old=prepare([row,{...row,id:'gone'}]).normalized;
 const same=prepare([row,{...row,id:'new'}],mapping,old);assert.equal(same.report.reconciliation.unchanged_keys.length,1);assert.equal(same.report.reconciliation.new_keys.length,1);assert.equal(same.report.reconciliation.missing_previous_keys.length,1);
 const changed=prepare([{...row,score:55}],mapping,old);assert.equal(changed.report.reconciliation.changed_keys.length,1);assert.throws(()=>reviewSQL(changed.normalized,changed.report),/changed/);
});
test('CSV quoting/newlines/unicode and malformed rejection',()=>{
 assert.deepEqual(parseCSV('id,name,score\r\na,"A, ""B""\nשלום",0\r\n'),[{id:'a',name:'A, "B"\nשלום',score:'0'}]);
 for(const csv of ['id,id\na,b','id,name\na','id\n"open','id\n"a"x']) assert.throws(()=>parseCSV(csv));
});
test('explicit milliseconds and timestamp transformations preserve original',()=>{
 const m={...mapping,fields:{...mapping.fields,time:{column:'time_ms',transform:'ms_to_seconds'},submitted_at:{column:'created_at',transform:'postgres_timestamp_to_rfc3339'}}};
 const r=prepare([{...row,time_ms:'15647',created_at:'2026-04-13 10:00:00.123456+00',deaths:'16'}],m).normalized.records[0];assert.equal(r.normalized.time,15.647);assert.equal(r.normalized.submitted_at,'2026-04-13T10:00:00.123456+00:00');assert.equal(r.normalized.health,null);assert.match(r.raw_json,/"deaths":"16"/);
});
test('archive SQL guards existing differences and escapes data; no destructive statements',()=>{
 const r=prepare([{...row,name:"O'Brien; DROP TABLE scores; --"}]);const sql=reviewSQL(r.normalized,r.report);
 assert.match(sql,/O''Brien/);assert.match(sql,/lock table public.sn_legacy_entries/);assert.match(sql,/is distinct from/);assert.doesNotMatch(sql,/insert into public.sn_entries/);assert.doesNotMatch(sql,/delete from|truncate table|update public/i);
 const dangerous=prepare([{...row,name:'$sn_legacy_import$'}]);assert.throws(()=>reviewSQL(dangerous.normalized,dangerous.report),/delimiter/);
});
