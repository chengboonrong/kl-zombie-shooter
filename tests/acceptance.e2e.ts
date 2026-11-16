import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';

// Acceptance: a model looks at the rendered game and judges it like a player
// would. Needs Claude Code signed in. Run with `npm run e2e:accept`.
describe('acceptance', { tags: ['acceptance'] }, () => {
  test('title screen shows the logo, controls and how to start', async ({ app, agent }) => {
    await app.open('/');
    await agent.assert(
      'a title screen with a "Pasar Malam Zombi!" logo, control instructions, and a prompt to click to start, ' +
      'on a yellow comic-book halftone overlay');
  });

  test('a player can start the game and pick the shotgun', async ({ app, agent, browser }) => {
    await app.open('/?debug');
    await agent.act('start the game');
    await agent.act('switch to the shotgun');
    await expect(browser.locator('#overlay')).toBeHidden();
    await expect(browser.locator('#weapon')).toHaveText('SHOTGUN');
  });

  test('gameplay shows zombies in a first-person night market with a readable HUD', async ({ app, browser, agent }) => {
    await app.open('/?debug');
    await browser.locator('#overlay').tap();
    // The model takes seconds per look; keep the horde from killing the player meanwhile.
    await browser.evaluate(`(function h() { for (const z of dbg.zombies) z.dmg = 0; requestAnimationFrame(h); })()`);
    await browser.keyboard.press('z'); // debug: spawn a horde
    await expect.poll(() => browser.evaluate<number>('dbg.zombies.length')).toBeGreaterThan(10);
    // Face the nearest zombie so the horde is in frame.
    await browser.evaluate(`(() => {
      const p = dbg.player.pos, z = dbg.zombies.map(z => z.g.position)
        .sort((a, b) => a.distanceTo(p) - b.distanceTo(p))[0];
      dbg.player.yaw = Math.atan2(p.x - z.x, p.z - z.z);
    })()`);
    await agent.assert(
      'a first-person view of a night market with stalls and lights, zombies in view, a gun at the bottom right, ' +
      'and HUD panels for WAVE, KILLS, HP and the weapon with its ammo, all readable');
    await agent.assert('the scene is rendered in a comic-book style with ink outlines and a halftone dot pattern');
  });

  test('game over screen reports the run', async ({ app, browser, agent }) => {
    await app.open('/?debug');
    await browser.locator('#overlay').tap();
    await expect(browser.locator('#wave')).toHaveText('1', { timeout: 10_000 });
    await browser.evaluate('dbg.player.hp = 0');
    await agent.assert(
      'a GAME OVER screen that shows how many waves were survived and the kill count, and says how to play again');
  });
});
