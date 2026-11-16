import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { claudeCode } from '@e2e-dev/acp';

export default {
  targets: [{
    // Headless Chromium never grants pointer lock; the init script emulates it.
    engine: web({ initScripts: [{ path: 'tests/support/pointer-lock.js' }] }),
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
