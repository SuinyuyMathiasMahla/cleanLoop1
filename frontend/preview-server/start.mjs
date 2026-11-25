// Starts preview mode: the stand-in backend plus one or both apps pointed at it.
//
//   node frontend/preview-server/start.mjs          admin portal and mobile app (web)
//   node frontend/preview-server/start.mjs web      admin portal only
//   node frontend/preview-server/start.mjs mobile   mobile app only (web build)
//   node frontend/preview-server/start.mjs server   stand-in backend only
//
// The apps get their settings from environment variables set here, which take
// precedence over any .env file, so a real .env with dev values is never used.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT, startPreviewServer } from './server.mjs';

const which = process.argv[2] ?? 'all';
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = `http://127.0.0.1:${PORT}`;
const WEB_PORT = Number(process.env.PREVIEW_WEB_PORT ?? 3100);
const MOBILE_PORT = Number(process.env.PREVIEW_MOBILE_PORT ?? 8090);

startPreviewServer();

const children = [];
function run(name, cwd, args, env) {
  // One command string, so Windows can run pnpm.cmd; the arguments are fixed above.
  const child = spawn(['pnpm', ...args].join(' '), {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: true,
  });
  child.on('exit', (code) => console.log(`[preview] ${name} stopped (${code ?? 'signal'})`));
  children.push(child);
}

if (which === 'all' || which === 'web') {
  run(
    'admin portal',
    path.join(frontend, 'web'),
    ['exec', 'vite', '--port', String(WEB_PORT), '--strictPort'],
    {
      VITE_PREVIEW: 'true',
      VITE_API_URL: api,
      VITE_COGNITO_ENDPOINT: `${api}/cognito/`,
      VITE_COGNITO_REGION: 'preview',
      VITE_COGNITO_CLIENT_ID: 'preview',
    },
  );
  console.log(
    `[preview] admin portal on http://localhost:${WEB_PORT}  (sign in as admin@preview.test, any password)`,
  );
}
if (which === 'all' || which === 'mobile') {
  run(
    'mobile app',
    path.join(frontend, 'mobile'),
    ['exec', 'expo', 'start', '--web', '--port', String(MOBILE_PORT)],
    {
      EXPO_PUBLIC_PREVIEW: 'true',
      EXPO_PUBLIC_API_URL: api,
      EXPO_PUBLIC_COGNITO_ENDPOINT: `${api}/cognito/`,
      EXPO_PUBLIC_COGNITO_REGION: 'preview',
      EXPO_PUBLIC_COGNITO_CLIENT_ID: 'preview',
      EXPO_PUBLIC_COGNITO_DOMAIN: 'preview',
      BROWSER: 'none',
    },
  );
  console.log(
    `[preview] mobile app on http://localhost:${MOBILE_PORT}  (citizen@preview.test or crew@preview.test, any password)`,
  );
}

const stop = () => {
  children.forEach((c) => c.kill());
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
