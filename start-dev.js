import { spawn } from 'child_process';

const isWin = process.platform === 'win32';
const cmd = isWin ? 'cmd.exe' : 'npm';
const backendArgs = isWin ? ['/c', 'npm', 'run', 'dev'] : ['run', 'dev'];
const frontendArgs = isWin ? ['/c', 'npm', 'run', 'dev'] : ['run', 'dev'];

console.log('\x1b[36m%s\x1b[0m', '=======================================================');
console.log('\x1b[36m%s\x1b[0m', '  🚀 ĐANG KHỞI ĐỘNG XEKO XUKA BULK PUBLISHER');
console.log('\x1b[36m%s\x1b[0m', '  - Backend:  http://localhost:5000');
console.log('\x1b[36m%s\x1b[0m', '  - Frontend: http://localhost:5173');
console.log('\x1b[36m%s\x1b[0m', '=======================================================');

// 1. Start Backend
const backend = spawn(cmd, backendArgs, {
  cwd: './backend',
  stdio: 'inherit',
});

// 2. Start Frontend
const frontend = spawn(cmd, frontendArgs, {
  cwd: './frontend',
  stdio: 'inherit',
});

backend.on('error', (err) => {
  console.error('[Backend Error]:', err.message);
});

frontend.on('error', (err) => {
  console.error('[Frontend Error]:', err.message);
});

const cleanup = () => {
  backend.kill();
  frontend.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
