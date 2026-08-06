#!/usr/bin/env node
/**
 * Run the test suite in a fixed non-UTC timezone.
 *
 * Local-vs-UTC calendar bugs (streak handling) are unobservable when the
 * runner is already on UTC, which GitHub Actions is by default. Pinning an
 * offset zone means a regression fails CI instead of passing quietly.
 *
 * Node caches the zone before any test code runs, so neither vitest's
 * `test.env` nor a `setupFiles` assignment to `process.env.TZ` has any effect.
 * The only reliable point is process start, hence spawning a child with TZ
 * already in its environment. Done here rather than inline in the npm script
 * so it works on Windows, where `TZ=... cmd` is not valid shell.
 *
 * Any extra arguments are forwarded to vitest.
 */

import { spawn } from 'node:child_process';

const TZ = process.env.DOPAMINE_TEST_TZ || 'Asia/Manila';

const child = spawn(
    'npx',
    ['vitest', 'run', '--root', 'packages/dopaminejs', ...process.argv.slice(2)],
    {
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: { ...process.env, TZ }
    }
);

child.on('exit', (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    process.exit(code ?? 1);
});
