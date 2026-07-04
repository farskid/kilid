import { expect, test } from '@playwright/test';

interface KilidWindow extends Window {
  __ready?: boolean;
  __kilid: typeof import('../src/index.js');
  __calls?: string[];
  __defaultPrevented?: boolean;
  __svc?: { isChordPending?: boolean };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/test/fixtures/smoke.html');
  await page.waitForFunction(() => (window as KilidWindow).__ready === true);
  await page.focus('#target');
});

test('keyboard: Ctrl+S fires in a real browser', async ({ page }) => {
  await page.evaluate(() => {
    const w = window as KilidWindow;
    const target = document.getElementById('target')!;
    w.__calls = [];
    const svc = w.__kilid.keybindings(target, { isMac: false });
    svc.add(w.__kilid.KeyMod.CtrlCmd | w.__kilid.KeyCode.KeyS, () => w.__calls!.push('save'));
    w.__svc = svc;
  });

  await page.keyboard.press('Control+s');
  await expect.poll(async () => page.evaluate(() => (window as KilidWindow).__calls)).toEqual(['save']);
});

test('keyboard: Ctrl+K Ctrl+S chord completes', async ({ page }) => {
  await page.evaluate(() => {
    const w = window as KilidWindow;
    const target = document.getElementById('target')!;
    w.__calls = [];
    const svc = w.__kilid.keybindings(target, { isMac: false });
    svc.add(
      w.__kilid.KeyChord(
        w.__kilid.KeyMod.CtrlCmd | w.__kilid.KeyCode.KeyK,
        w.__kilid.KeyMod.CtrlCmd | w.__kilid.KeyCode.KeyS
      ),
      () => w.__calls!.push('chord')
    );
    w.__svc = svc;
  });

  await page.keyboard.press('Control+k');
  await expect
    .poll(async () => page.evaluate(() => (window as KilidWindow).__svc!.isChordPending))
    .toBe(true);
  await page.keyboard.press('Control+s');
  await expect.poll(async () => page.evaluate(() => (window as KilidWindow).__calls)).toEqual(['chord']);
});

test('pointer: Ctrl+click fires with real modifier keys', async ({ page }) => {
  await page.evaluate(() => {
    const w = window as KilidWindow;
    const target = document.getElementById('target')!;
    w.__calls = [];
    const svc = w.__kilid.pointerBindings(target, { isMac: false });
    svc.add(w.__kilid.KeyMod.CtrlCmd | w.__kilid.MouseButton.Left, 'click', () =>
      w.__calls!.push('ctrl-click')
    );
    w.__svc = svc;
  });

  await page.keyboard.down('Control');
  await page.locator('#target').click({ force: true });
  await page.keyboard.up('Control');
  await expect.poll(async () => page.evaluate(() => (window as KilidWindow).__calls)).toEqual([
    'ctrl-click',
  ]);
});

test('pointer: wheel with ctrl modifier maps to WheelUp', async ({ page }) => {
  await page.evaluate(() => {
    const w = window as KilidWindow;
    const target = document.getElementById('target')!;
    w.__calls = [];
    const svc = w.__kilid.pointerBindings(target, { isMac: false });
    svc.add(w.__kilid.KeyMod.CtrlCmd | w.__kilid.MouseButton.WheelUp, 'wheel', () =>
      w.__calls!.push('zoom-in')
    );
    w.__svc = svc;
  });

  await page.keyboard.down('Control');
  await page.locator('#target').hover();
  await page.mouse.wheel(0, -120);
  await page.keyboard.up('Control');
  await expect.poll(async () => page.evaluate(() => (window as KilidWindow).__calls)).toEqual([
    'zoom-in',
  ]);
});

test('pointer: pointerType filter works in browser', async ({ page }) => {
  await page.evaluate(() => {
    const w = window as KilidWindow;
    const target = document.getElementById('target')!;
    w.__calls = [];
    const svc = w.__kilid.pointerBindings(target, { isMac: false });
    svc.add(w.__kilid.MouseButton.Left, 'down', () => w.__calls!.push('pen'), { pointerType: 'pen' });
    w.__svc = svc;
  });

  await page.locator('#target').dispatchEvent('pointerdown', { button: 0, pointerType: 'mouse' });
  await page.locator('#target').dispatchEvent('pointerdown', { button: 0, pointerType: 'pen' });
  await expect.poll(async () => page.evaluate(() => (window as KilidWindow).__calls)).toEqual(['pen']);
});

test('keyboard: preventDefault is applied on match', async ({ page }) => {
  await page.evaluate(() => {
    const w = window as KilidWindow;
    const target = document.getElementById('target')!;
    w.__defaultPrevented = false;
    const svc = w.__kilid.keybindings(target, { isMac: false });
    svc.add(w.__kilid.KeyMod.CtrlCmd | w.__kilid.KeyCode.KeyP, (e) => {
      w.__defaultPrevented = e.defaultPrevented;
    });
    w.__svc = svc;
  });

  await page.keyboard.press('Control+p');
  await expect.poll(async () => page.evaluate(() => (window as KilidWindow).__defaultPrevented)).toBe(
    true
  );
});
