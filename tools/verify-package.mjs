import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
const baseline=JSON.parse(await readFile('docs/V20-BASELINE.json','utf8'));
const revisedForSeason2=new Set(['dist/logic.js','dist/scoring.js','dist/score-view.js','dist/score-preview.js']);
for(const [file,expected] of Object.entries(baseline.unchangedFiles))if(!revisedForSeason2.has(file))assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),expected,`Approved v20 file changed: ${file}`);
let syntax=0;
async function check(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(['.git','.openai','node_modules','.netlify'].includes(entry.name))continue;const file=path.join(dir,entry.name);if(entry.isDirectory())await check(file);else if(/\.(mjs|js)$/.test(file)){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,`${file}: ${result.stderr}`);syntax++;}}}
await check('.');
for(const file of ['dist/index.html','dist/leaderboard.html','dist/privacy.html','netlify/functions/leaderboard.mjs','supabase/migrations/202611050001_leaderboard.sql','.env.example'])await readFile(file);
assert(!(await readFile('dist/game.js','utf8')).includes('SUPABASE_SECRET_KEY'));
for(const args of [['--test','season2-tests.mjs','server/api.test.js'],['integration-tests.mjs']]){
 const result=spawnSync(process.execPath,args,{encoding:'utf8'});
 assert.equal(result.status,0,`Release smoke checks failed:
${result.stdout}
${result.stderr}`);
 console.log(result.stdout.split(String.fromCharCode(10)).filter(l=>l.startsWith("PASS:")||l.startsWith("ℹ pass")).slice(-4).join(String.fromCharCode(10)));
}
console.log(`PASS: ${Object.keys(baseline.unchangedFiles).length-revisedForSeason2.size} unchanged approved assets byte-identical, ${syntax} JavaScript modules parse, required package files present.`);
