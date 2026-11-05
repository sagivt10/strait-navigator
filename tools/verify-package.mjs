import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
const baseline=JSON.parse(await readFile('docs/V20-BASELINE.json','utf8'));
for(const [file,expected] of Object.entries(baseline.unchangedFiles))assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),expected,`Approved v20 file changed: ${file}`);
let syntax=0;
async function check(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(['.git','.openai','node_modules','.netlify'].includes(entry.name))continue;const file=path.join(dir,entry.name);if(entry.isDirectory())await check(file);else if(/\.(mjs|js)$/.test(file)){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,`${file}: ${result.stderr}`);syntax++;}}}
await check('.');
for(const file of ['dist/index.html','dist/leaderboard.html','dist/privacy.html','netlify/functions/leaderboard.mjs','supabase/migrations/202611050001_leaderboard.sql','.env.example'])await readFile(file);
assert(!(await readFile('dist/game.js','utf8')).includes('SUPABASE_SECRET_KEY'));
console.log(`PASS: ${Object.keys(baseline.unchangedFiles).length} approved v20 files/assets byte-identical, ${syntax} JavaScript modules parse, required package files present.`);
