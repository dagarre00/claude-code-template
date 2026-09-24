// Runs one process under a time limit and, when the limit hits, stops it and
// everything it started. Shared by the worker runner and the red check — the two
// places the conductor runs something that can outlive its welcome.
//
// A plain timeout (spawnSync's, or killing the direct child) is not enough:
// measured on Windows, the red check's timeout killed cmd.exe and left the test
// process it had started running, holding the worktree open; an engine CLI
// likewise starts its own children. So the whole tree goes:
//
//   - Windows: `taskkill /T /F` — the process and every descendant by parent id.
//   - Linux, macOS and other POSIX: the child leads its own process group
//     (detached), which gets SIGTERM, then SIGKILL after a grace period. SIGTERM
//     first because an engine CLI uses it to stop its own tools cleanly (claude
//     -p exits 143 and ends its running command's tree).
//
// Nothing here needs a shell: a command line is run with `shell: true` only when
// the caller hands over a command line (a project's test command), and an argv
// is spawned directly.
import { spawn, spawnSync } from 'node:child_process';

export const KILL_GRACE_MS = 5000;

export function killTree(pid, { platform = process.platform, signal = 'SIGKILL' } = {}) {
  if (!pid) return;
  if (platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    return;
  }
  try { process.kill(-pid, signal); }
  catch { try { process.kill(pid, signal); } catch { /* already gone */ } }
}

// Keeps the last `limit` bytes of a stream without holding the whole of it.
function tailCollector(limit) {
  let chunks = [];
  let size = 0;
  return {
    push(chunk) {
      chunks.push(chunk);
      size += chunk.length;
      while (chunks.length > 1 && size - chunks[0].length >= limit) size -= chunks.shift().length;
    },
    text() {
      const buffer = Buffer.concat(chunks);
      return (buffer.length > limit ? buffer.subarray(buffer.length - limit) : buffer).toString('utf8');
    }
  };
}

// Resolves once the process tree is done, never rejects. `status` is the exit
// code, or null when the process was killed by a signal or never started — in
// which case `signal`, `timed_out` or `error` says why.
//
// stdio: an array as for spawn (file descriptors, 'ignore', 'inherit'); any
// 'pipe' stream is collected, and only its last `tailBytes` bytes are kept.
export function runBounded({ file, args = [], command, cwd, env = process.env, timeoutMs,
  stdio = ['ignore', 'pipe', 'pipe'], tailBytes = 64 * 1024, onStart } = {}) {
  return new Promise(resolvePromise => {
    const posix = process.platform !== 'win32';
    const options = { cwd, env, stdio, windowsHide: true, detached: posix };
    let child;
    try {
      child = command != null ? spawn(command, { ...options, shell: true }) : spawn(file, args, options);
    } catch (error) {
      resolvePromise({ status: null, signal: null, timed_out: false, error: error.message, output: '' });
      return;
    }
    const output = tailCollector(tailBytes);
    child.stdout?.on('data', chunk => output.push(chunk));
    child.stderr?.on('data', chunk => output.push(chunk));
    let timed_out = false;
    let error = null;
    let settled = false;
    let escalate = null;
    const timer = timeoutMs ? setTimeout(() => {
      timed_out = true;
      if (!posix) { killTree(child.pid); return; }
      killTree(child.pid, { signal: 'SIGTERM' });
      escalate = setTimeout(() => killTree(child.pid), KILL_GRACE_MS);
    }, timeoutMs) : null;
    const finish = (status, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(escalate);
      // The group leader is done; anything it left behind in its group is not
      // wanted either after a timeout. POSIX only: a process group id is not
      // reused while members remain, whereas a Windows pid can be reused the
      // moment its process exits — and taskkill /T already took the whole tree.
      if (timed_out && posix) killTree(child.pid);
      resolvePromise({ status: Number.isInteger(status) ? status : null, signal: signal ?? null, timed_out, error,
        output: output.text() });
    };
    child.on('error', spawnError => {
      error = `${spawnError.code ?? ''} ${spawnError.message}`.trim();
      // A process that never started emits no 'close' on every platform.
      if (child.pid === undefined) finish(null, null);
    });
    child.on('close', finish);
    onStart?.(child);
  });
}
