import { spawn } from 'node:child_process';

const commands = [
  ['npm', ['run', 'dev:api']],
  ['npm', ['run', 'dev:web']],
];

const children = commands.map(([cmd, args]) => {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  child.on('exit', (code) => {
    if (code && code !== 0) process.exitCode = code;
  });
  return child;
});

function shutdown() {
  for (const child of children) child.kill('SIGTERM');
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
