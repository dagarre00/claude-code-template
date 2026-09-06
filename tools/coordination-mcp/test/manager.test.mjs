import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { Manager } from '../manager.mjs';

const source = resolve(import.meta.dirname,'../../..');
const git = (cwd,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(),'coordination-test-'));
  cpSync(resolve(source,'.harness'),resolve(root,'.harness'),{recursive:true});
  writeFileSync(resolve(root,'sample.txt'),'base\n');
  git(root,'init','-b','integration'); git(root,'config','core.autocrlf','false'); git(root,'config','user.email','fixture@example.invalid'); git(root,'config','user.name','Fixture');
  git(root,'add','.'); git(root,'commit','-m','fixture');
  const manager = new Manager(root,'codex',{launch(taskDir) {
    writeFileSync(resolve(taskDir,'result.json'),JSON.stringify({state:'completed',exit_code:0,finished_at:new Date().toISOString()}));
    writeFileSync(resolve(taskDir,'stdout.log'),'REPORT fixture output\n');
  }});
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  return {root,manager};
}
const task = {role:'developer',instructions:'Scoped test task: café "x"\n$(do-not-execute)',owned_paths:['sample.txt']};
const commit = (workspace,text)=>{writeFileSync(resolve(workspace,'sample.txt'),text);git(workspace,'add','sample.txt');git(workspace,'commit','-m','worker case');};
const integrate = (manager,id,root)=>manager.merge(id,git(root,'rev-parse','HEAD'),manager.status(id).worker_sha);

test('worker commits remain isolated until explicit SHA-pinned integration; cleanup is idempotent', t=>{
  const {root,manager}=fixture(t);
  const worker=manager.spawn(task);
  assert.notEqual(worker.workspace,root);
  assert.equal(git(root,'status','--porcelain'),'');
  commit(worker.workspace,'worker\n');
  assert.equal(readFileSync(resolve(root,'sample.txt'),'utf8'),'base\n');
  assert.throws(()=>manager.merge(worker.task_id,'0'.repeat(40),git(worker.workspace,'rev-parse','HEAD')),/target.*SHA/i);
  const merged=integrate(manager,worker.task_id,root);
  assert.equal(merged.state,'cleaned');
  assert.equal(readFileSync(resolve(root,'sample.txt'),'utf8'),'worker\n');
  assert.ok(!existsSync(worker.workspace));
  assert.match(manager.status(worker.task_id).output,/REPORT/);
  assert.equal(integrate(manager,worker.task_id,root).state,'cleaned');
});

test('dirty checkouts, scope violations, failed workers and worker recursion preserve work',t=>{
  const {root,manager}=fixture(t);
  writeFileSync(resolve(root,'untracked.txt'),'user data');
  assert.throws(()=>manager.spawn(task),/dirty/);
  rmSync(resolve(root,'untracked.txt'));
  assert.throws(()=>manager.spawn({...task,role:'../bad'}),/role/i);
  assert.throws(()=>manager.spawn({...task,owned_paths:['../elsewhere']}),/path/i);
  assert.throws(()=>new Manager(root,'codex',{worker:true}).spawn(task),/Workers cannot/);
  const worker=manager.spawn(task);
  commit(worker.workspace,'first\n');
  writeFileSync(resolve(worker.workspace,'untracked.txt'),'keep me');
  assert.throws(()=>integrate(manager,worker.task_id,root),/dirty/);
  git(worker.workspace,'add','untracked.txt');git(worker.workspace,'commit','-m','out of scope');
  assert.throws(()=>integrate(manager,worker.task_id,root),/scope/);
  assert.ok(existsSync(worker.workspace));
  assert.equal(readFileSync(resolve(root,'sample.txt'),'utf8'),'base\n');
});

test('conflicts retain both sides and a deliberate resolved merge can finish cleanup',t=>{
  const {root,manager}=fixture(t);
  const worker=manager.spawn(task);
  commit(worker.workspace,'worker side\n');
  commit(root,'integration side\n');
  assert.equal(integrate(manager,worker.task_id,root).state,'conflict');
  assert.ok(existsSync(worker.workspace));
  assert.match(readFileSync(resolve(root,'sample.txt'),'utf8'),/<<<<<<< /);
  writeFileSync(resolve(root,'sample.txt'),'resolved by conductor\n');
  git(root,'add','sample.txt');git(root,'commit','--no-edit');
  assert.equal(integrate(manager,worker.task_id,root).state,'cleaned');
});

test('read-only reports survive cleanup; restarted supervisors recover completed tasks',t=>{
  const {root,manager}=fixture(t);
  const worker=manager.spawn({role:'adversary',instructions:'Read only fixture'});
  const restarted=new Manager(root,'claude');
  assert.equal(restarted.list().length,1);
  assert.equal(integrate(restarted,worker.task_id,root).state,'cleaned');
  assert.match(restarted.log(worker.task_id).text,/REPORT fixture/);
  assert.equal(restarted.kill(worker.task_id).state,'cleaned');
});

test('validation failure retains merged branch and allows a safe retry',t=>{
  const {root,manager}=fixture(t);
  const settingsPath=resolve(root,'.harness/settings.json');
  const settings=JSON.parse(readFileSync(settingsPath,'utf8'));
  settings.validation=[[process.execPath,'-e','process.exit(1)']];
  writeFileSync(settingsPath,JSON.stringify(settings));git(root,'add','.harness/settings.json');git(root,'commit','-m','fixture validation');
  const worker=manager.spawn(task);commit(worker.workspace,'worker\n');
  assert.equal(integrate(manager,worker.task_id,root).state,'validation-failed');
  assert.ok(existsSync(worker.workspace));
  settings.validation=[];writeFileSync(settingsPath,JSON.stringify(settings));git(root,'add','.harness/settings.json');git(root,'commit','-m','fixture validation repair');
  assert.equal(integrate(manager,worker.task_id,root).state,'cleaned');
});
