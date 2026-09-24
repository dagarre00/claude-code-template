// bounded.mjs is how the conductor runs its own long commands — the test suite
// before a cycle, an install — so that none outlives its run or floods the
// conductor's context.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runLine } from '../bounded.mjs';

const BOUNDED = fileURLToPath(new URL('../bounded.mjs', import.meta.url));
const node = `"${process.execPath}"`;

test('a command line keeps its exit code, and only a bounded tail of its output', async () => {
  const result = await runLine(`${node} -e "console.log('x'.repeat(50000)); console.log('the end'); process.exitCode = 4"`,
    { tailBytes: 500 });
  assert.equal(result.exit_code, 4);
  assert.ok(result.output_tail.length <= 500 && /the end/.test(result.output_tail));
});

test('a command past its limit is stopped and exits 124', async () => {
  const started = Date.now();
  const result = await runLine(`${node} -e "setTimeout(() => {}, 60000)"`, { timeoutSeconds: 1 });
  assert.equal(result.exit_code, 124);
  assert.equal(result.timed_out, true);
  assert.ok(Date.now() - started < 20_000);
});

test('the CLI prints the tail and a verdict line, and exits with the command\'s code', () => {
  const run = spawnSync(process.execPath, [BOUNDED, '--timeout', '60', '--', `${node} -e "console.log('suite: 3 passed'); process.exitCode = 1"`],
    { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stdout, /suite: 3 passed/);
  assert.match(run.stdout, /FAIL .*exit 1/);
  assert.equal(spawnSync(process.execPath, [BOUNDED], { encoding: 'utf8' }).status, 2, 'no command is a usage error');
});
