import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
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
  // Say which side of the recursion guard this is, rather than inheriting it from
  // the environment: these are conductor tests, and a suite that reads
  // COORDINATION_WORKER from ambient state cannot run inside a dispatched worker
  // — measured, as 10 failures of "Workers cannot mutate coordination state".
  // The guard itself is asserted below with an explicit worker:true.
  const manager = new Manager(root,'claude',{worker:false,launch(taskDir) {
    writeFileSync(resolve(taskDir,'result.json'),JSON.stringify({state:'completed',exit_code:0,finished_at:new Date().toISOString()}));
    writeFileSync(resolve(taskDir,'stdout.log'),'REPORT fixture output\n');
  }});
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  return {root,manager};
}
const task = {role:'developer',instructions:'Scoped test task: café "x"\n$(do-not-execute)',owned_paths:['sample.txt']};
const commit = (workspace,text)=>{writeFileSync(resolve(workspace,'sample.txt'),text);git(workspace,'add','sample.txt');git(workspace,'commit','-m','worker case');};
const integrate = (manager,id,root)=>manager.merge(id,git(root,'rev-parse','HEAD'),manager.status(id).worker_sha);

// One dispatch per Behavior case only reproduces the project's history if each
// integration is a fast-forward. A merge bubble per case doubles the log and
// hides the order the cases were done in.
test('an integration that can fast-forward does, leaving one commit per case', t=>{
  const {root,manager}=fixture(t);
  const before=git(root,'rev-list','--count','HEAD');
  for (const subject of ['feat(sample): first case','feat(sample): second case']) {
    const worker=manager.spawn({...task,commit_message:subject});
    writeFileSync(resolve(worker.workspace,'sample.txt'),`${subject}\n`);
    git(worker.workspace,'add','sample.txt'); git(worker.workspace,'commit','-m',subject);
    assert.equal(integrate(manager,worker.task_id,root).state,'cleaned');
  }
  assert.equal(Number(git(root,'rev-list','--count','HEAD')),Number(before)+2,'two cases, two commits, no merge bubbles');
  assert.deepEqual(git(root,'log','-2','--format=%s').split('\n'),['feat(sample): second case','feat(sample): first case']);
  assert.equal(git(root,'log','-2','--format=%p').split('\n').filter(p=>p.includes(' ')).length,0,'no commit has two parents');
});

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
  const restarted=new Manager(root,'claude',{worker:false});
  assert.equal(restarted.list().length,1);
  assert.equal(integrate(restarted,worker.task_id,root).state,'cleaned');
  assert.match(restarted.log(worker.task_id).text,/REPORT fixture/);
  assert.equal(restarted.kill(worker.task_id).state,'cleaned');
});

test('roles() lists every agent from frontmatter, sorted, with {{cmd:}} expanded, and names a malformed role file loudly',t=>{
  const {root,manager}=fixture(t);
  const roles=manager.roles();
  assert.deepEqual(roles.map(r=>r.name),[...roles.map(r=>r.name)].sort((a,b)=>a.localeCompare(b)));
  assert.deepEqual(Object.keys(roles[0]).sort(),['access','description','effort','engine','model','name','profile']);
  const developer=roles.find(r=>r.name==='developer');
  assert.equal(developer.profile,'balanced');
  assert.equal(developer.access,'write');
  assert.ok(!developer.description.includes('{{cmd:'),'macro must be expanded');
  assert.ok(developer.description.includes('project-work'),'{{cmd:work}} expands to project-work');
  assert.ok(!developer.description.startsWith('"') && !developer.description.endsWith('"'),'surrounding quotes must be stripped');
  const adversary=roles.find(r=>r.name==='adversary');
  assert.equal(adversary.profile,'reasoning');
  assert.equal(adversary.access,'read-only');
  writeFileSync(resolve(root,'.harness/agents/broken.md'),'---\nname: broken\ndescription: "Bad role"\nprofile: nonsense\naccess: write\n---\n');
  assert.throws(()=>manager.roles(),/broken\.md/);
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

// Regression: worktrees used to live under .git/coordination/workspaces/<id>.
// Every unit test passed because they inject a fake launch, but a real Claude
// worker could not write a single file there — the CLI refuses to write anywhere
// under .git, so all three write roles were silently undeliverable. Verified
// empirically: identical flags, same repo, worktree outside .git succeeds.
test('worker worktrees live outside the git directory, where CLI write guards allow edits', t=>{
  const {root,manager}=fixture(t);
  const worker=manager.spawn(task);
  const common=resolve(git(root,'rev-parse','--path-format=absolute','--git-common-dir'));
  const normalise=path=>resolve(path).replaceAll('\\','/').toLowerCase();
  assert.ok(!normalise(worker.workspace).startsWith(normalise(common)+'/'),
    `workspace ${worker.workspace} must not be inside the git dir ${common}`);
  assert.ok(normalise(worker.workspace).startsWith(normalise(root)+'/'),'workspace stays inside the repo');
  assert.ok(existsSync(resolve(worker.workspace,'.git')),'worktree is a real checkout');
  // The workspace root must be ignored, or it would dirty the integration
  // checkout and manager.spawn refuses to dispatch against a dirty tree.
  assert.equal(git(root,'status','--porcelain=v1','--untracked-files=all'),'','integration checkout stays clean');
  assert.equal(git(root,'check-ignore','.worktrees'),'.worktrees');
});

// Codex edits files but cannot commit them: its workspace-write sandbox protects
// .git (openai/codex#18918 on Windows, #27418 for linked worktrees, both open).
// A write worker that produces no commits is rejected at integration anyway, so
// refuse the dispatch up front, before the model has been paid for.
// ~30KB of metadata and logs per dispatch, and nothing ever removed any of it.
test('cleaned task records are pruned to the retention limit; evidence never is', t=>{
  const {root,manager}=fixture(t);
  const tasks=resolve(root,'.git/coordination/tasks');
  const settingsPath=resolve(root,'.harness/settings.json');
  const settings=JSON.parse(readFileSync(settingsPath,'utf8'));
  settings.taskRetention=1;
  writeFileSync(settingsPath,JSON.stringify(settings));
  git(root,'add','-A'); git(root,'commit','-m','fixture retention');
  const cycle=subject=>{
    const worker=manager.spawn({...task,commit_message:subject});
    commit(worker.workspace,`${subject}\n`);
    assert.equal(integrate(manager,worker.task_id,root).state,'cleaned');
    return worker.task_id;
  };
  const first=cycle('feat(sample): first'), second=cycle('feat(sample): second');
  // Pruning happens at dispatch, and only past the limit: one cleaned record at
  // the time of the second dispatch is within it, so nothing was removed yet.
  assert.ok(existsSync(resolve(tasks,first)),'both cleaned records survived their own cycles');
  // A worker whose result was never integrated is evidence, not clutter.
  const preserved=manager.spawn({role:'adversary',instructions:'Read only'}).task_id;
  assert.ok(!existsSync(resolve(tasks,first)),'the oldest cleaned record is gone');
  const latest=manager.spawn({...task,owned_paths:['other.txt']}).task_id;
  for (const id of [second,preserved,latest]) assert.ok(existsSync(resolve(tasks,id)),`kept ${id}`);
  assert.equal(manager.list().length,3,'a pruned record is not a task with a missing file');
});

// Shared build state is the reason a dispatched worker can run tests at all, and
// the reason cleanup has to be careful: `git worktree remove` follows a junction
// on Windows and deletes the tree behind it. Verified directly — a bare
// `worktree remove --force` over a junction destroyed the linked node_modules.
test('shared build state is validated at dispatch and survives worktree cleanup',t=>{
  const {root,manager}=fixture(t);
  const settingsPath=resolve(root,'.harness/settings.json');
  const settings=JSON.parse(readFileSync(settingsPath,'utf8'));
  const configure=paths=>{
    settings.sharedPaths=paths;
    writeFileSync(settingsPath,JSON.stringify(settings));
    git(root,'add','-A'); git(root,'commit','-m','fixture shared paths');
  };
  writeFileSync(resolve(root,'.gitignore'),'node_modules/\n');
  mkdirSync(resolve(root,'node_modules/pkg'),{recursive:true});
  writeFileSync(resolve(root,'node_modules/pkg/index.js'),'module.exports=42;\n');
  mkdirSync(resolve(root,'tracked'),{recursive:true});
  writeFileSync(resolve(root,'tracked/keep.txt'),'source, not build output\n');
  configure(['node_modules']);

  const worker=manager.spawn(task);
  assert.deepEqual(worker.commit && JSON.parse(readFileSync(resolve(root,'.git/coordination/tasks',worker.task_id,'task.json'),'utf8'))
    .shared_paths.map(s=>s.path),['node_modules']);
  // Stand in for the runner, which is what normally creates and removes these.
  // A link surviving into cleanup is exactly the crashed-runner case.
  symlinkSync(resolve(root,'node_modules'),resolve(worker.workspace,'node_modules'),
    process.platform==='win32'?'junction':'dir');
  assert.equal(git(worker.workspace,'status','--porcelain=v1','--untracked-files=all'),'','an ignored link keeps the worker checkout clean');
  commit(worker.workspace,'worker\n');
  assert.equal(integrate(manager,worker.task_id,root).state,'cleaned');
  assert.ok(!existsSync(worker.workspace));
  assert.equal(readFileSync(resolve(root,'node_modules/pkg/index.js'),'utf8'),'module.exports=42;\n',
    'cleanup removed the link, not the shared tree behind it');

  // A tracked directory would have the worker's real checkout replaced by a link.
  configure(['tracked']);
  assert.throws(()=>manager.spawn(task),/ignored by Git/i);
  configure(['sample.txt']);
  assert.throws(()=>manager.spawn(task),/not a directory/i);
  // A rejected dispatch must leave nothing behind that breaks the next one.
  // Resolving shared paths after the task directory existed left an empty one on
  // every rejection, and list() then threw on it — one bad settings value bricked
  // every future spawn until somebody deleted the directory by hand.
  assert.doesNotThrow(()=>manager.list(),'a rejected dispatch leaves no half-written task');
  mkdirSync(resolve(root,'.git/coordination/tasks/00000000-0000-4000-8000-000000000000'),{recursive:true});
  assert.doesNotThrow(()=>manager.list(),'a task directory with no task.json describes no task');
  // A path that simply does not exist here is skipped, not an error: a JS project
  // has no .venv and should not have to say so.
  configure(['.venv']);
  assert.equal(JSON.parse(readFileSync(resolve(root,'.git/coordination/tasks',manager.spawn(task).task_id,'task.json'),'utf8'))
    .shared_paths.length,0);
});

// Rather than one delivery shape per engine, no worker commits anywhere: the
// runner does. So a write role dispatches on every engine, and every worker is
// told the same thing regardless of which sandbox it is behind.
test('every engine accepts write roles and delivers them the same way: the supervisor commits', t=>{
  const {root,manager}=fixture(t);
  const dir=id=>resolve(root,'.git/coordination/tasks',id);
  for (const engine of ['claude','codex','antigravity']) {
    const worker=manager.spawn({...task,cli_engine:engine,commit_message:`feat(sample): ${engine} case`});
    assert.equal(worker.engine,engine);
    assert.equal(worker.commit.message,`feat(sample): ${engine} case`);
    assert.equal(JSON.parse(readFileSync(resolve(dir(worker.task_id),'task.json'),'utf8')).commit.message,
      `feat(sample): ${engine} case`,'the runner reads the policy from task.json, not from the tool call');
    // The canonical contract tells write roles to leave files; the dispatch
    // repeats it with the subject the conductor chose, so no worker spends turns
    // on git commands its sandbox would deny.
    const prompt=readFileSync(resolve(dir(worker.task_id),'prompt.txt'),'utf8');
    assert.match(prompt,/## Delivery/);
    assert.match(prompt,/Do not run any git command/);
    assert.ok(prompt.includes(`feat(sample): ${engine} case`),'the worker is told the subject it will be committed under');
    git(root,'worktree','remove','--force',worker.workspace);
    git(root,'branch','-D',worker.branch);
  }
  // Read-only roles produce no commit at all, so there is no subject to set.
  const reviewer=manager.spawn({role:'adversary',cli_engine:'codex',instructions:'Review.',owned_paths:[]});
  assert.equal(reviewer.commit,null);
  assert.ok(!readFileSync(resolve(dir(reviewer.task_id),'prompt.txt'),'utf8').includes('## Delivery'));
  assert.throws(()=>manager.spawn({role:'adversary',instructions:'Review.',commit_message:'docs: nope'}),/read-only/i);
  assert.throws(()=>manager.spawn({...task,commit_message:'subject\nbody'}),/single line/i);
  assert.throws(()=>manager.spawn({...task,commit_message:'x'.repeat(201)}),/single line/i);
  assert.equal(git(root,'status','--porcelain=v1','--untracked-files=all'),'','no dispatch or refusal dirtied the checkout');
});
