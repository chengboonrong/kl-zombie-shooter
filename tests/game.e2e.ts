import { beforeEach, describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';

// `?debug` exposes the game's state as window.dbg; tests read it instead of pixels.
type Page = { evaluate<T>(src: string): Promise<T> };
type Snap = { state: string; wave: number; kills: number; hp: number; zombies: number; weapon: string };
// Hold the trigger until one shot registers; a down+up inside one frame fires nothing.
async function fireOnce(b: { mouse: { down(): Promise<void>; up(): Promise<void> }; locator(s: string): any }) {
  await b.mouse.down();
  await expect(b.locator('#ammo')).not.toHaveText('12 / ∞');
  await b.mouse.up();
}
// Zombies still chase and get hit, but never hurt the player.
const harmless = `(function h() { for (const z of dbg.zombies) z.dmg = 0; requestAnimationFrame(h); })()`;
const snap = (b: Page) => b.evaluate<Snap>(`({
  state: dbg.game.state, wave: dbg.game.wave, kills: dbg.game.kills, hp: dbg.player.hp,
  zombies: dbg.zombies.length, weapon: dbg.weapons[dbg.ws.cur].name })`);

describe('title screen', () => {
  test('shows the logo and how to start', async ({ app, browser }) => {
    await app.open('/?debug');
    await expect(browser.locator('#logo')).toBeVisible();
    await expect(browser.locator('#overlay')).toContainText('WASD move');
    await expect(browser.locator('#overlay')).toContainText('CLICK TO START');
  });
});

describe('playing', () => {
  beforeEach(async ({ app, browser }) => {
    await app.open('/?debug');
    await browser.locator('#overlay').tap();
    await expect(browser.locator('#overlay')).toBeHidden();
  });

  test('wave 1 starts and zombies spawn', async ({ browser }) => {
    await expect(browser.locator('#wave')).toHaveText('1', { timeout: 20_000 });
    await expect.poll(() => snap(browser).then(s => s.zombies), { timeout: 20_000 }).toBeGreaterThan(0);
  });

  test('firing the pistol spends ammo', async ({ browser }) => {
    await expect(browser.locator('#ammo')).toHaveText('12 / ∞');
    await fireOnce(browser);
    await expect(browser.locator('#ammo')).toHaveText(/^([0-9]|1[01]) \/ ∞$/); // fewer than 12: the pistol repeats while held
  });

  test('reload refills the magazine', async ({ browser }) => {
    await fireOnce(browser);
    await browser.keyboard.press('r');
    await expect(browser.locator('#ammo')).toHaveText('RELOADING…');
    await expect(browser.locator('#ammo')).toHaveText('12 / ∞');
  });

  test('number keys switch weapons', async ({ browser }) => {
    await browser.keyboard.press('2');
    await expect(browser.locator('#weapon')).toHaveText('SHOTGUN');
    await expect(browser.locator('#ammo')).toHaveText('6 / 12');
    await browser.keyboard.press('5');
    await expect(browser.locator('#weapon')).toHaveText('MERCUN');
  });

  test('Esc pauses and a click resumes the same run', async ({ browser }) => {
    await expect(browser.locator('#wave')).toHaveText('1', { timeout: 20_000 });
    await browser.keyboard.press('Escape');
    await expect(browser.locator('#title')).toHaveText('PAUSED');
    await browser.locator('#overlay').tap();
    await expect(browser.locator('#overlay')).toBeHidden();
    await expect.poll(() => snap(browser)).toMatchObject({ state: 'play', wave: 1 });
  });

  test('aiming at a zombie and firing kills it', async ({ browser }) => {
    await browser.evaluate(harmless);
    await expect.poll(() => snap(browser).then(s => s.zombies), { timeout: 20_000 }).toBeGreaterThan(0);
    // Turn the camera onto the nearest zombie's chest every frame, as a player's mouse would.
    await browser.evaluate(`(function aim() {
      const p = dbg.player.pos, z = dbg.zombies
        .map(z => z.g.position).sort((a, b) => a.distanceTo(p) - b.distanceTo(p))[0];
      if (z) {
        const dx = z.x - p.x, dz = z.z - p.z;
        dbg.player.yaw = Math.atan2(-dx, -dz);
        dbg.player.pitch = Math.atan2(1.0 - (p.y + 1.65), Math.hypot(dx, dz));
      }
      requestAnimationFrame(aim);
    })()`);
    await browser.mouse.down();
    await expect(browser.locator('#kills')).not.toHaveText('0', { timeout: 60_000 });
    await browser.mouse.up();
  });

  test('dying shows the game over screen and a click starts over', async ({ browser }) => {
    await expect(browser.locator('#wave')).toHaveText('1', { timeout: 20_000 });
    await browser.evaluate('dbg.player.hp = 0');
    await expect(browser.locator('#title')).toHaveText('GAME OVER!');
    await expect(browser.locator('#overlay')).toContainText('WAVES SURVIVED: 0');
    await expect(browser.locator('#overlay')).toContainText('CLICK TO PLAY AGAIN');
    await expect.poll(async () => {
      await browser.locator('#overlay').tap(); // ignored for 800 ms after death
      return snap(browser);
    }, { timeout: 5_000, interval: 300 }).toMatchObject({ state: 'play', hp: 100, kills: 0 });
  });
});
