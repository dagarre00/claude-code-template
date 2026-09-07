import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readSync,
  readdirSync, realpathSync, renameSync, rmSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve, relative, isAbsolute, dirname, sep } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { loadSettings, workerCommand, engineNames, isSafeRepoPath } from './config.mjs';

// Worktrees must NOT live under .git: agent CLIs refuse to write anywhere inside
// the git directory, which silently made every write role undeliverable. Task
// metadata and logs stay in .git/coordination — nothing spawns a CLI there.
const workspaceRoot = '.worktrees';
const idPattern = /^[a-f0-9-]{36}$/;
const slug = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export function json(path) { return JSON.parse(readFileSync(path,'utf8')); }
export function save(path,value) {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary,JSON.stringify(value,null,2)+'\n');
  renameSync(temporary,path);
}
export function tail(path,limit=24000,offset) {
  if (!existsSync(path)) return {text:'',next_offset:0};
  const size = statSync(path).size;
  const start = offset === undefined ? Math.max(0,size-limit) : Math.min(offset,size);
  const data = Buffer.alloc(Math.min(limit,size-start));
  const fd = openSync(path,'r');
  let count;
  try { count=readSync(fd,data,0,data.length,start); } finally { closeSync(fd); }
  return {text:data.subarray(0,count).toString('utf8'),next_offset:start+count,total_bytes:size};
}
function contained(root,path) {
  const rel=relative(root,path);
  if (!rel || isAbsolute(rel) || rel==='..' || rel.startsWith(`..${sep}`)) throw new Error('Path escapes coordination storage');
  let cursor=root;
  for (const part of rel.split(sep)) {
    cursor=resolve(cursor,part);
    if (lstatSync(cursor,{throwIfNoEntry:false})?.isSymbolicLink()) throw new Error('Coordination storage cannot contain symlinks');
  }
  return path;
}
export function git(root,args,{allowFailure=false}={}) {
  const result=spawnSync('git',['-C',root,...args],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});
  if (result.error || result.status !== 0) {
    if (allowFailure) return null;
    throw new Error(`git ${args[0]} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`);
  }
  return result.stdout.trim();
}
const clean = root => git(root,['status','--porcelain=v1','--untracked-files=all']) === '';
const head = root => git(root,['rev-parse','HEAD']);
const branch = root => git(root,['symbolic-ref','--quiet','--short','HEAD']);
const overlap = (a,b)=>a===b || a.startsWith(b+'/') || b.startsWith(a+'/');
// Subject line for a supervisor-made commit. It ends up in the project's history
// verbatim, so it is held to the same shape as any other argv value: one line, no
// control characters, and short enough to read in `git log --oneline`.
function subject(input, role, id) {
  if (input == null) return `chore(${role}): supervised worker ${id.slice(0,8)}`;
  if (typeof input!=='string' || !input.trim() || input.length>200 || /[\0\r\n]/.test(input)) {
    throw new Error('commit_message must be a single line of at most 200 characters');
  }
  return input.trim();
}
function paths(input) {
  if (!Array.isArray(input)) throw new Error('owned_paths must be an array');
  return [...new Set(input.map(path=>{
    if (!isSafeRepoPath(path)) throw new Error('Invalid owned path');
    return path;
  }))];
}

export class Manager {
  constructor(root,engine,{launch,worker=process.env.COORDINATION_WORKER==='1'}={}) {
    this.root=realpathSync(root);
    if (realpathSync(git(this.root,['rev-parse','--show-toplevel']))!==this.root) throw new Error('Root must be a Git worktree root');
    if (!engineNames.includes(engine)) throw new Error('Unknown conductor engine');
    this.engine=engine; this.worker=worker; this.launch=launch;
    this.common=realpathSync(git(this.root,['rev-parse','--path-format=absolute','--git-common-dir']));
    this.storage=contained(this.common,resolve(this.common,'coordination'));
    this.workspaces=contained(this.root,resolve(this.root,workspaceRoot));
  }
  // The workspace root sits in the integration checkout, so it must be ignored or
  // it dirties the tree that spawn/merge both require to be clean. Guaranteeing it
  // here rather than trusting the project's .gitignore keeps the control plane
  // correct in any adopting repository, including one that rewrote that file.
  exclude() {
    const path=contained(this.common,resolve(this.common,'info','exclude'));
    mkdirSync(dirname(path),{recursive:true});
    const current=existsSync(path)?readFileSync(path,'utf8'):'';
    const entry=`/${workspaceRoot}/`;
    if (current.split(/\r?\n/).includes(entry)) return;
    writeFileSync(path,current+(current && !current.endsWith('\n')?'\n':'')+entry+'\n');
  }
  // Build state a worker needs and Git does not carry. Resolved and checked here,
  // at dispatch, so a misconfigured path fails before the model has been paid for;
  // the runner is what actually creates the links, because they must not outlive
  // the process that made them. Missing sources are skipped — a JS project has no
  // .venv — but a source that exists and is wrong is an error, not a shrug.
  shared(settings) {
    return settings.sharedPaths.flatMap(path=>{
      const source=contained(this.root,resolve(this.root,path));
      if (!existsSync(source)) return [];
      if (!statSync(source).isDirectory()) throw new Error(`Shared path is not a directory: ${path}`);
      // A tracked shared path would have the worktree's real checkout replaced by
      // a link: Git reports a type change, the worker checkout is dirty, and the
      // merge refuses. Ignored is the only safe state, so require it explicitly.
      if (git(this.root,['check-ignore','--quiet','--',path],{allowFailure:true})===null) {
        throw new Error(`Shared path must be ignored by Git, or linking it dirties the worker checkout: ${path}`);
      }
      return [{path,source}];
    });
  }
  // Defensive sweep for a runner that died before it could unlink. Only ever
  // removes a link, never a directory: `git worktree remove` follows a junction
  // on Windows and deletes the shared tree behind it, which would silently
  // destroy the integration checkout's node_modules.
  unlink(task) {
    for (const {path} of task.shared_paths ?? []) {
      const link=resolve(task.workspace,path);
      if (lstatSync(link,{throwIfNoEntry:false})?.isSymbolicLink()) unlinkSync(link);
    }
  }
  // Every dispatch leaves ~30KB of metadata and logs behind, and nothing used to
  // remove any of it. Only fully cleaned tasks are eligible: a failed, cancelled,
  // conflicted or still-running task is evidence, and evidence is not pruned.
  prune(keep) {
    const dir=contained(this.storage,resolve(this.storage,'tasks'));
    if (!existsSync(dir)) return;
    const cleaned=readdirSync(dir).filter(id=>idPattern.test(id)).flatMap(id=>{
      const taskPath=resolve(this.taskDir(id),'task.json'), phasePath=resolve(this.taskDir(id),'phase.json');
      if (!existsSync(taskPath) || !existsSync(phasePath)) return [];
      const task=json(taskPath);
      if (task.integration_root!==this.root || json(phasePath).state!=='cleaned') return [];
      return [{id,at:Date.parse(task.created_at) || 0}];
    }).sort((a,b)=>b.at-a.at);
    for (const {id} of cleaned.slice(keep)) rmSync(contained(this.storage,this.taskDir(id)),{recursive:true,force:true});
  }
  assertConductor() {
    if (this.worker) throw new Error('Workers cannot mutate coordination state or recursively delegate');
  }
  lock(fn) {
    this.assertConductor();
    contained(this.common,this.storage);
    mkdirSync(this.storage,{recursive:true});
    const path=contained(this.storage,resolve(this.storage,'control.lock'));
    try { mkdirSync(path); } catch (e) { if (e.code==='EEXIST') throw new Error('Coordination is busy or has a stale lock; inspect control.lock before recovery'); throw e; }
    try { save(resolve(path,'owner.json'),{pid:process.pid,created_at:new Date().toISOString()});return fn(); }
    finally { unlinkSync(resolve(path,'owner.json'));rmdirSync(path); }
  }
  taskDir(id) {
    if (!idPattern.test(id)) throw new Error('Invalid task ID');
    return contained(this.storage,resolve(this.storage,'tasks',id));
  }
  task(id) {
    contained(this.common,this.storage);
    const task=json(resolve(this.taskDir(id),'task.json'));
    if (task.task_id!==id || task.integration_root!==this.root
      || task.workspace!==resolve(this.workspaces,id) || task.branch!==`worker/${id}`) throw new Error('Task ownership mismatch');
    contained(this.workspaces,task.workspace);
    return task;
  }
  list() {
    contained(this.common,this.storage);
    const dir=contained(this.storage,resolve(this.storage,'tasks'));
    return !existsSync(dir)?[]:readdirSync(dir).filter(id=>idPattern.test(id)).flatMap(id=>{
      // A directory with no task.json is a dispatch that died between creating it
      // and writing it — a crash, a full disk. It describes no task, so it is not
      // one; reading it as one would make the whole control plane unusable until
      // somebody deleted it by hand.
      if (!existsSync(resolve(this.taskDir(id),'task.json'))) return [];
      const task=json(resolve(this.taskDir(id),'task.json'));
      return task.integration_root===this.root?[this.status(id)]:[];
    });
  }
  status(id) {
    const task=this.task(id), dir=this.taskDir(id);
    const result=existsSync(resolve(dir,'result.json'))?json(resolve(dir,'result.json')):null;
    const phase=existsSync(resolve(dir,'phase.json'))?json(resolve(dir,'phase.json')):{};
    const heartbeat=resolve(dir,'heartbeat');
    const recent=Date.now()-(existsSync(heartbeat)?statSync(heartbeat).mtimeMs:Date.parse(task.created_at))<15000;
    const state=phase.state ?? result?.state ?? (recent?'running':'interrupted');
    const worker_sha=existsSync(task.workspace)?head(task.workspace):phase.worker_sha;
    const commits=worker_sha?git(this.root,['log','--format=%H %s',`${task.base_sha}..${worker_sha}`]):'';
    return {task_id:id,role:task.role,engine:task.engine,model:task.command.model,effort:task.command.effort,
      commit:task.commit,
      state,workspace:task.workspace,branch:task.branch,base_sha:task.base_sha,worker_sha,
      target_sha:head(this.root),integration_branch:task.integration_branch,owned_paths:task.owned_paths,
      created_at:task.created_at,result,commits,output:tail(resolve(dir,'stdout.log')).text,
      diagnostics:tail(resolve(dir,'stderr.log'),6000).text,detail:phase.detail};
  }
  log(id,stream='stdout',offset=0) {
    this.task(id);
    if (!['stdout','stderr'].includes(stream) || !Number.isSafeInteger(offset) || offset<0) throw new Error('Invalid log cursor');
    return tail(resolve(this.taskDir(id),`${stream}.log`),24000,offset);
  }
  roles() {
    const dir=resolve(this.root,'.harness/agents');
    // Resolve the engine/model/effort each role would actually run with, so the
    // configuration is verifiable without spawning a worker to find out.
    const settings=loadSettings(this.root);
    return readdirSync(dir).filter(file=>file.endsWith('.md')).map(file=>{
      const name=file.replace(/\.md$/,'');
      const role=readFileSync(resolve(dir,file),'utf8').replace(/\r\n/g,'\n');
      const profile=role.match(/^profile: (.+)$/m)?.[1];
      const access=role.match(/^access: (.+)$/m)?.[1];
      // Malformed metadata must be visible, not silently dropped from the catalog:
      // fail loudly and name the offending file rather than excluding it quietly.
      if (!['reasoning','balanced','fast'].includes(profile) || !['read-only','write'].includes(access)) {
        throw new Error(`Invalid role metadata in .harness/agents/${file}`);
      }
      let description=role.match(/^description: (.+)$/m)?.[1] ?? '';
      if (description.startsWith('"') && description.endsWith('"')) description=description.slice(1,-1);
      description=description.replace(/\{\{cmd:([a-z-]+)\}\}/g,'project-$1');
      const configured=settings.roles[name]?.engine ?? settings.defaultEngine;
      const engine=configured==='inherit'?this.engine:configured;
      const command=workerCommand(settings,{engine,role:name,profile,access,workspace:this.workspaces});
      return {name,description,profile,access,engine,model:command.model,effort:command.effort};
    }).sort((a,b)=>a.name.localeCompare(b.name));
  }
  spawn(input) {
    return this.lock(()=>{
      const settings=loadSettings(this.root);
      if (!slug.test(input.role??'')) throw new Error('Invalid role');
      const rolePath=resolve(this.root,`.harness/agents/${input.role}.md`);
      if (!existsSync(rolePath)) throw new Error(`Unknown role: ${input.role}`);
      const role=readFileSync(rolePath,'utf8').replace(/\r\n/g,'\n');
      const profile=role.match(/^profile: (.+)$/m)?.[1];
      const access=role.match(/^access: (.+)$/m)?.[1];
      if (!['reasoning','balanced','fast'].includes(profile) || !['read-only','write'].includes(access)) throw new Error('Invalid role metadata');
      if (typeof input.instructions!=='string' || !input.instructions.trim() || input.instructions.length>100000) throw new Error('Instructions required (at most 100000 characters)');
      const owned=paths(input.owned_paths??[]);
      if (access==='write' && !owned.length) throw new Error('Write workers require explicit owned_paths');
      const engine=input.cli_engine ?? settings.roles[input.role]?.engine ?? settings.defaultEngine;
      const resolvedEngine=engine==='inherit'?this.engine:engine;
      this.exclude();
      const id=randomUUID(), workspace=contained(this.workspaces,resolve(this.workspaces,id));
      // One delivery convention for every CLI: the worker writes files, the
      // supervising runner commits them. Read-only roles never get a commit —
      // producing one is exactly what disqualifies them at merge.
      if (access!=='write' && input.commit_message!=null) throw new Error('Read-only roles produce no commit; commit_message does not apply');
      const commit=access==='write' ? {message:subject(input.commit_message,input.role,id)} : null;
      const command=workerCommand(settings,{...input,engine:resolvedEngine,profile,access,workspace});
      // Every check that can reject the dispatch runs before any state is
      // created. Resolving shared paths after taskDir() existed was enough to
      // leave an empty task directory behind on a rejection, which list() then
      // read as a task and threw on — one bad settings value bricked every
      // future spawn in the repository.
      const shared_paths=this.shared(settings);
      this.prune(settings.taskRetention);
      const active=this.list().filter(t=>['running','interrupted'].includes(t.state));
      if (active.length>=settings.maxWorkers) throw new Error('Worker concurrency limit reached');
      if (active.some(t=>owned.some(a=>t.owned_paths.some(b=>overlap(a.toLowerCase(),b.toLowerCase()))))) throw new Error('Owned scope overlaps an active worker');
      if (!clean(this.root)) throw new Error('Integration checkout is dirty; commit scoped changes before dispatch');
      const integration_branch=branch(this.root), base_sha=head(this.root);
      const dir=this.taskDir(id);
      mkdirSync(dir,{recursive:true});
      const task={task_id:id,role:input.role,profile,access,engine:resolvedEngine,command,owned_paths:owned,commit,shared_paths,
        integration_root:this.root,integration_branch,workspace,branch:`worker/${id}`,base_sha,
        created_at:new Date().toISOString(),timeout_seconds:settings.workerTimeoutSeconds};
      save(resolve(dir,'task.json'),task);
      // Stated per dispatch because it inverts what a write role would otherwise
      // assume, and because two of the three engines would spend turns failing at
      // git before reporting the denial as a blocker.
      const delivery=!commit ? ''
        : '\n\n## Delivery\n\nDo not run any git command that changes the repository — no add, commit, branch,'
          + ' merge, reset, stash, or tag. Leave every change in the worktree as files. After you exit'
          + ` successfully the supervisor stages your owned paths and commits them as \`${commit.message}\`.`
          + ' Anything you changed outside owned_paths is committed by nobody and fails integration, so keep'
          + ' every edit inside your scope. Report changed paths, verification commands and their results, and'
          + ' any blockers; leaving work unfinished is a blocker, leaving it uncommitted is expected.';
      const prompt=readFileSync(resolve(this.root,'.harness/worker-contract.md'),'utf8')
        +'\n\n## Canonical role\n\n'+role.replace(/\{\{cmd:([a-z-]+)\}\}/g,'project-$1')+delivery
        +'\n\n## Assignment\n\n'+JSON.stringify({task_id:id,workspace,branch:task.branch,base_sha,owned_paths:owned,instructions:input.instructions},null,2);
      writeFileSync(resolve(dir,'prompt.txt'),prompt);
      try {
        git(this.root,['worktree','add','-b',task.branch,workspace,base_sha]);
        if (this.launch) this.launch(dir);
        else {
          const child=spawn(process.execPath,[resolve(import.meta.dirname,'runner.mjs'),dir],{cwd:this.root,detached:true,windowsHide:true,stdio:'ignore',env:{...process.env,COORDINATION_WORKER:'1'}});
          child.on('error',error=>save(resolve(dir,'result.json'),{state:'failed',error:error.message}));
          child.unref();
        }
      } catch (error) {
        save(resolve(dir,'result.json'),{state:'failed',error:error.message});
        throw new Error(`Task ${id} could not start; preserved at ${dir}: ${error.message}`);
      }
      return this.status(id);
    });
  }
  kill(id) {
    return this.lock(()=>{
      this.task(id);
      const dir=this.taskDir(id);
      if (!existsSync(resolve(dir,'result.json'))) writeFileSync(resolve(dir,'cancel'),'Requested by conductor\n');
      return {...this.status(id),cancellation_requested:true};
    });
  }
  merge(id,expectedTarget,expectedWorker) {
    return this.lock(()=>{
      const task=this.task(id),dir=this.taskDir(id),status=this.status(id);
      if (status.state==='cleaned') return status;
      if (status.result?.state!=='completed' || status.result.exit_code!==0) throw new Error('Worker has not completed successfully; preserve its work');
      if (head(this.root)!==expectedTarget) throw new Error('Target SHA changed; inspect the new target before retrying');
      if (status.worker_sha!==expectedWorker) throw new Error('Worker SHA changed; review the new commits before retrying');
      if (branch(this.root)!==task.integration_branch) throw new Error('Integration branch changed');
      if (!clean(this.root)) throw new Error('Integration checkout is dirty or has unresolved conflicts');
      if (branch(task.workspace)!==task.branch) throw new Error('Worker branch changed');
      if (!clean(task.workspace)) throw new Error('Worker checkout is dirty; retain uncommitted work');
      if (git(this.root,['merge-base','--is-ancestor',task.base_sha,expectedWorker],{allowFailure:true})===null
        || git(this.root,['merge-base','--is-ancestor',task.base_sha,expectedTarget],{allowFailure:true})===null) throw new Error('Recorded base is no longer an ancestor');
      const changed=git(task.workspace,['diff','--name-only','-z',task.base_sha,expectedWorker]).split('\0').filter(Boolean);
      if (task.access==='read-only' && expectedWorker!==task.base_sha) throw new Error('Read-only worker produced commits');
      if (changed.some(path=>!task.owned_paths.some(scope=>path===scope || path.startsWith(scope+'/')))) throw new Error('Worker changed paths outside its owned scope');
      if (task.access==='write' && expectedWorker===task.base_sha) throw new Error('Write worker produced no deliverable commits');
      if (expectedWorker!==task.base_sha && git(this.root,['merge-base','--is-ancestor',expectedWorker,expectedTarget],{allowFailure:true})===null) {
        // Fast-forward when the integration branch has not moved since dispatch,
        // which is the normal case once work is dispatched one Behavior case at a
        // time. That reproduces the history the cadence is meant to produce — one
        // commit per case, in order — instead of burying each case under a merge
        // bubble that doubles the log and hides the sequence.
        try { git(this.root,['merge','--ff-only',task.branch]); }
        catch {
          try { git(this.root,['merge','--no-ff','--no-edit',task.branch]); }
          catch(error) {
            save(resolve(dir,'phase.json'),{state:'conflict',worker_sha:expectedWorker,detail:error.message});
            return this.status(id);
          }
        }
      }
      save(resolve(dir,'phase.json'),{state:'merged',worker_sha:expectedWorker});
      // Validate the combined integration tree, not only an isolated worker tree.
      for (const command of loadSettings(this.root).validation) {
        const check=spawnSync(command[0],command.slice(1),{cwd:this.root,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:1024*1024});
        if (check.error || check.status!==0 || !clean(this.root)) {
          save(resolve(dir,'phase.json'),{state:'validation-failed',worker_sha:expectedWorker,detail:{command,status:check.status,error:check.error?.message,output:(check.stdout+check.stderr).slice(-12000)}});
          return this.status(id);
        }
      }
      // Verify exact registered ownership immediately before removing. Never force.
      const registrations=git(this.root,['worktree','list','--porcelain','-z']).split('\0\0');
      const registered=registrations.some(entry=>entry.split('\0').includes(`worktree ${task.workspace.replaceAll('\\','/')}`)
        && entry.split('\0').includes(`branch refs/heads/${task.branch}`));
      if (!registered) throw new Error('Worktree registration changed; refusing cleanup');
      try {
        // Must precede removal: git follows a junction into the shared tree.
        this.unlink(task);
        git(this.root,['worktree','remove',task.workspace]);
        git(this.root,['branch','-d',task.branch]);
      } catch(error) {
        save(resolve(dir,'phase.json'),{state:'cleanup-failed',worker_sha:expectedWorker,detail:error.message});
        return this.status(id);
      }
      save(resolve(dir,'phase.json'),{state:'cleaned',worker_sha:expectedWorker});
      return this.status(id);
    });
  }
}
