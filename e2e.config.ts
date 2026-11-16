import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { claudeCode } from '@e2e-dev/acp';

export default {
  targets: [{
    engine: web({
      // Headless Chromium never grants pointer lock; the init script emulates it.
      initScripts: [{ path: 'tests/support/pointer-lock.js' }],
      // CI has no GPU: software WebGL runs ~2 fps at 1280x720, and game time
      // slows with it (dt is capped per frame). A small viewport keeps it playable.
      ...(process.env.CI ? { viewport: { width: 480, height: 270 } } : {}),
    }),
    app: {
      url: 'http://localhost:5179',
      command: { executable: 'npm', args: ['run', 'dev', '--', '--port', '5179', '--strictPort'], reuseExisting: true, log: '.e2e/logs/app.log' },
    },
  }],
  // Agent steps (tests tagged `acceptance`) run on your Claude Code login.
  agents: { default: { executor: claudeCode({
    model: 'sonnet',
    system: 'The game draws its world on a WebGL canvas the accessibility tree cannot see. ' +
      'Take a screenshot and judge visual claims from its pixels.',
  }) } },
  timeout: 120_000,
} satisfies E2EConfig;
