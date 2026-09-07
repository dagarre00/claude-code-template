// Detached task owner. The MCP process may disconnect without losing the worker.
// Only this live owner signals its child; the server never kills a persisted PID.
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { json, save } from './manager.mjs';

export async function run(dir) {
  const task=json(resolve(dir,'task.json'));
  const started_at=new Date().toISOString();
  const limit=16*1024*1024;
  let child,finished=false,reason,timer,forceTimer,heartbeat;
  const counts={stdout:0,stderr:0};
  const finish=(exit_code,signal,error)=>{
    if (finished) return;
    finished=true;
    clearInterval(heartbeat);clearTimeout(timer);clearTimeout(forceTimer);
    save(resolve(dir,'result.json'),{state:reason??(exit_code===0?'completed':'failed'),exit_code,signal,error,
      started_at,finished_at:new Date().toISOString()});
  };
  const stop=why=>{
    if (finished || reason) return;
    reason=why;
    if (!child?.pid || child.exitCode!==null) return;
    if (process.platform==='win32') {
      // Owned, still-live child only; no command strings and no caller-supplied PID.
      const result=spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
      if (result.status!==0) child.kill();
    } else {
      try { process.kill(-child.pid,'SIGTERM'); } catch { child.kill(); }
      forceTimer=setTimeout(()=>{ try { process.kill(-child.pid,'SIGKILL'); } catch {} },2000);
    }
  };
  const record=(stream,data)=>{
    const allowed=Math.max(0,limit-counts[stream]);
    appendFileSync(resolve(dir,`${stream}.log`),data.subarray(0,allowed));
    counts[stream]+=data.length;
    if (counts[stream]>limit) stop('output-limit');
  };
  writeFileSync(resolve(dir,'heartbeat'),started_at);
  if (existsSync(resolve(dir,'cancel'))) { finish(null,null,'Cancelled before launch'); return; }
  try {
    const env={...process.env,COORDINATION_WORKER:'1'};
    delete env.CLAUDECODE;
    child=spawn(task.command.executable,task.command.args,{cwd:task.workspace,env,
      shell:false,windowsHide:true,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']});
    child.stdin.on('error',()=>{}); // Early authentication/launch failures may close stdin.
    child.stdout.on('data',data=>record('stdout',data));
    child.stderr.on('data',data=>record('stderr',data));
    child.on('error',error=>finish(null,null,error.message));
    child.on('close',(code,signal)=>finish(code,signal));
    // Some CLIs read a bare prompt from stdin; others require a framed message.
    // The engine adapter decides, so the runner stays engine-agnostic.
    const promptText=readFileSync(resolve(dir,'prompt.txt'),'utf8');
    child.stdin.end(task.command.promptFormat==='stream-json'
      ? JSON.stringify({event:'user',message:{role:'user',content:[{type:'text',text:promptText}]}})+'\n'
      : promptText);
    heartbeat=setInterval(()=>{
      writeFileSync(resolve(dir,'heartbeat'),new Date().toISOString());
      if (existsSync(resolve(dir,'cancel'))) stop('cancelled');
    },500);
    timer=setTimeout(()=>stop('timed-out'),task.timeout_seconds*1000);
    process.once('SIGTERM',()=>stop('interrupted'));
    process.once('SIGINT',()=>stop('interrupted'));
  } catch(error) { finish(null,null,error.message); }
}

if (process.argv[1] && resolve(process.argv[1])===resolve(import.meta.dirname,'runner.mjs')) {
  run(resolve(process.argv[2])).catch(error=>{console.error(error.message);process.exitCode=1;});
}
