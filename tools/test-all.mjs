import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const files=(await readdir('.')).filter(file=>file.endsWith('tests.mjs')).sort();
files.push('server/api.test.js','tools/legacy-prepare-tests.mjs');
let failed=[];
for(const file of files){const result=spawnSync(process.execPath,[file],{encoding:'utf8'});if(result.status!==0){failed.push(file);process.stderr.write(`FAIL ${file}\n${result.stdout}\n${result.stderr}\n`);}else console.log(`PASS ${file}`);}
console.log(`${files.length-failed.length}/${files.length} test suites passed.`);if(failed.length)process.exit(1);
