import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

async function until(fn,timeout=10000) {
  const deadline=Date.now()+timeout;
  while (!fn()) { if (Date.now()>deadline) throw new Error('Runner did not finish');await new Promise(r=>setTimeout(r,50)); }
}
test('runner passes exact stdin without shell evaluation, records exit and cancels its child',async t=>{
  const root=mkdtempSync(resolve(tmpdir(),'runner-test-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const prompt='café "path with spaces"\n$(touch INJECTED) & echo NO';
  const script=resolve(root,'fake.mjs');
  writeFileSync(script,'process.stdin.pipe(process.stdout);');
  writeFileSync(resolve(root,'prompt.txt'),prompt);
  const task={workspace:root,command:{executable:process.execPath,args:[script]},timeout_seconds:10};
  writeFileSync(resolve(root,'task.json'),JSON.stringify(task));
  const start=()=>spawn(process.execPath,[resolve(import.meta.dirname,'../runner.mjs'),root],{windowsHide:true,stdio:'ignore'});
  const first=start();
  await until(()=>existsSync(resolve(root,'result.json')));
  assert.equal(JSON.parse(readFileSync(resolve(root,'result.json'),'utf8')).state,'completed');
  assert.equal(readFileSync(resolve(root,'stdout.log'),'utf8'),prompt);
  assert.ok(!existsSync(resolve(root,'INJECTED')));
  await until(()=>first.exitCode!==null);
  rmSync(resolve(root,'result.json'));
  writeFileSync(script,'setInterval(()=>{},1000);');
  const second=start();
  await new Promise(r=>setTimeout(r,300));
  writeFileSync(resolve(root,'cancel'),'stop');
  await until(()=>existsSync(resolve(root,'result.json')));
  assert.equal(JSON.parse(readFileSync(resolve(root,'result.json'),'utf8')).state,'cancelled');
  await until(()=>second.exitCode!==null);
});
