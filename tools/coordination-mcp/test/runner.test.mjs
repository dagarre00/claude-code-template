import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

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

// The delivery convention: a worker on any engine writes files and never runs
// git, because two of the three cannot. The runner is an ordinary host process
// outside every CLI sandbox, so it turns those files into the commit that
// merge_and_cleanup_worker requires.
const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
function supervised(t,{script,owned=['src'],commit={message:'feat(sample): supervised delivery'},shared=false}) {
  const dir=mkdtempSync(resolve(tmpdir(),'runner-commit-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const workspace=resolve(dir,'workspace');
  mkdirSync(resolve(workspace,'src'),{recursive:true});
  writeFileSync(resolve(workspace,'src/base.txt'),'base\n');
  writeFileSync(resolve(workspace,'.gitignore'),'node_modules/\n');
  git(workspace,'init','-b','worker');
  git(workspace,'config','core.autocrlf','false');
  git(workspace,'config','user.email','fixture@example.invalid');
  git(workspace,'config','user.name','Fixture');
  git(workspace,'add','.'); git(workspace,'commit','-m','base');
  // Build state that lives outside the worktree, as node_modules does.
  const source=resolve(dir,'build-state');
  if (shared) { mkdirSync(resolve(source,'pkg'),{recursive:true}); writeFileSync(resolve(source,'pkg/index.js'),'module.exports=42;\n'); }
  const fake=resolve(dir,'fake.mjs');
  writeFileSync(fake,script);
  writeFileSync(resolve(dir,'prompt.txt'),'do the work');
  writeFileSync(resolve(dir,'task.json'),JSON.stringify({workspace,owned_paths:owned,commit,
    shared_paths:shared?[{path:'node_modules',source}]:[],
    command:{executable:process.execPath,args:[fake]},timeout_seconds:20}));
  spawn(process.execPath,[resolve(import.meta.dirname,'../runner.mjs'),dir],{windowsHide:true,stdio:'ignore'});
  return {dir,workspace,source,result:async()=>{
    await until(()=>existsSync(resolve(dir,'result.json')));
    return JSON.parse(readFileSync(resolve(dir,'result.json'),'utf8'));
  }};
}

// A worktree holds only tracked files, so it arrives with no node_modules and a
// dispatched developer cannot run the project's tests — measured: the suite dies
// with ERR_MODULE_NOT_FOUND in a fresh worktree. The runner links the integration
// checkout's build state in for exactly as long as the worker runs.
test('shared build state is live during the run and unlinked the moment it ends',async t=>{
  const {workspace,source,result}=supervised(t,{shared:true,script:
    "import {readFileSync,writeFileSync} from 'node:fs';"
    +"writeFileSync('src/proof.txt',readFileSync('node_modules/pkg/index.js','utf8'));"});
  const outcome=await result();
  assert.equal(outcome.state,'completed');
  // The worker read through the link while running.
  assert.equal(git(workspace,'show','HEAD:src/proof.txt'),'module.exports=42;');
  // And nothing is left pointing at it. This is not tidiness: `git worktree
  // remove` follows a junction on Windows and deletes the tree behind it, so a
  // surviving link would put the integration checkout's node_modules one
  // `--force` away from deletion.
  assert.ok(!existsSync(resolve(workspace,'node_modules')),'the link does not outlive the worker');
  assert.equal(readFileSync(resolve(source,'pkg/index.js'),'utf8'),'module.exports=42;\n','shared state is untouched');
  assert.equal(git(workspace,'status','--porcelain=v1','--untracked-files=all'),'');
});

test('a worker that fails still leaves no link behind',async t=>{
  const {workspace,source,result}=supervised(t,{shared:true,script:
    "import {existsSync} from 'node:fs';if(!existsSync('node_modules/pkg/index.js'))throw new Error('no link');process.exit(4);"});
  const outcome=await result();
  assert.equal(outcome.exit_code,4,'the link was there while it ran');
  assert.ok(!existsSync(resolve(workspace,'node_modules')),'a preserved worktree must be safe to remove');
  assert.ok(existsSync(resolve(source,'pkg/index.js')));
});

test('the runner commits a successful worker\'s owned paths under the conductor\'s subject',async t=>{
  const {workspace,result}=supervised(t,{script:
    "import {writeFileSync} from 'node:fs';writeFileSync('src/added.txt','from the worker\\n');"
    +"writeFileSync('src/base.txt','edited\\n');"});
  const outcome=await result();
  assert.equal(outcome.state,'completed');
  assert.equal(outcome.commit,git(workspace,'rev-parse','HEAD'));
  assert.equal(git(workspace,'log','-1','--format=%s'),'feat(sample): supervised delivery');
  assert.deepEqual(outcome.committed_paths.sort(),['src/added.txt','src/base.txt']);
  // A clean worktree is what merge_and_cleanup_worker insists on before it will
  // integrate; the whole point is that the worker did not have to produce it.
  assert.equal(git(workspace,'status','--porcelain=v1','--untracked-files=all'),'');
});

test('the runner commits nothing outside owned paths, and says which paths stopped it',async t=>{
  const {workspace,result}=supervised(t,{script:
    "import {writeFileSync} from 'node:fs';writeFileSync('src/added.txt','ok\\n');"
    +"writeFileSync('elsewhere.txt','not mine\\n');"});
  const outcome=await result();
  assert.equal(outcome.state,'failed');
  assert.match(outcome.error,/outside its owned scope/);
  assert.match(outcome.error,/elsewhere\.txt/);
  assert.equal(outcome.commit,null);
  assert.equal(git(workspace,'rev-list','--count','HEAD'),'1','no commit was made at all');
  // Evidence survives: a partial commit would have hidden which half was refused.
  assert.equal(readFileSync(resolve(workspace,'elsewhere.txt'),'utf8'),'not mine\n');
  assert.equal(readFileSync(resolve(workspace,'src/added.txt'),'utf8'),'ok\n');
});

test('a failed, cancelled or empty worker is never committed for',async t=>{
  const failed=supervised(t,{script:
    "import {writeFileSync} from 'node:fs';writeFileSync('src/half.txt','incomplete\\n');process.exit(3);"});
  const outcome=await failed.result();
  assert.equal(outcome.state,'failed');
  assert.equal(outcome.exit_code,3);
  assert.equal(outcome.commit,null);
  assert.equal(git(failed.workspace,'rev-list','--count','HEAD'),'1');
  assert.equal(readFileSync(resolve(failed.workspace,'src/half.txt'),'utf8'),'incomplete\n','work is preserved for inspection');
  // A worker that changed nothing gets no empty commit; merge then rejects it as
  // a write worker with no deliverable, which is the accurate outcome.
  const idle=supervised(t,{script:'process.exit(0);'});
  const quiet=await idle.result();
  assert.equal(quiet.state,'completed');
  assert.equal(quiet.commit,null);
  assert.equal(git(idle.workspace,'rev-list','--count','HEAD'),'1');
});

test('read-only tasks carry no commit policy, so the runner cannot commit for one',async t=>{
  const {workspace,result}=supervised(t,{commit:null,owned:[],script:
    "import {writeFileSync} from 'node:fs';writeFileSync('src/sneaked.txt','review output\\n');"});
  const outcome=await result();
  assert.equal(outcome.state,'completed');
  assert.ok(!('commit' in outcome),'no commit field is reported for a role that must not produce one');
  assert.equal(git(workspace,'rev-list','--count','HEAD'),'1');
});
