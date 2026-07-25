import { chromium } from 'playwright';

const OUT = 'artifacts/screenshots/visual-office-v2';

const viewports = [
  { name: 'desktop-1440x900',  w: 1440, h: 900,  dpr: 1 },
  { name: 'desktop-1366x768',  w: 1366, h: 768,  dpr: 1 },
  { name: 'tablet-820x1180',   w: 820,  h: 1180, dpr: 2 },
  { name: 'mobile-412x915',    w: 412,  h: 915,  dpr: 2 },
  { name: 'mobile-390x844',    w: 390,  h: 844,  dpr: 2 },
];

const browser = await chromium.launch({ headless: true });
const allResults = {};

for (const vp of viewports) {
  console.log(`\n=== ${vp.name} ===`);
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: vp.dpr,
  });
  const page = await ctx.newPage();

  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // ── INITIAL STATE CHECK (D-02) ──
  const initialState = await page.evaluate(() => {
    const selectedBtn = document.querySelector('.agent-sprite--selected');
    const bubble = document.querySelector('.speech-bubble');
    const inspector = document.querySelector('.inspector');
    return {
      hasSelected: !!selectedBtn,
      hasBubble: !!bubble,
      hasInspector: !!inspector,
    };
  });

  // ── CENTER SCREENSHOT ──
  await page.screenshot({ path: `${OUT}/${vp.name}-center.png`, fullPage: false });

  // ── SELECT SIRIUS ──
  const siriusBtn = page.locator('.agent-sprite').first();
  if (await siriusBtn.count() > 0) {
    await siriusBtn.click({ force: true });
    await page.waitForTimeout(800);
  }

  // ── INSPECTOR SCREENSHOT ──
  await page.screenshot({ path: `${OUT}/${vp.name}-inspector.png`, fullPage: false });

  // ── CHECK INSPECTOR STATE AFTER CLICK ──
  const afterClick = await page.evaluate(() => {
    const selected = document.querySelector('.agent-sprite--selected');
    const bubble = document.querySelector('.speech-bubble');
    const inspector = document.querySelector('.inspector');
    return {
      hasSelected: !!selected,
      selectedAgent: selected?.getAttribute('aria-label')?.split(' — ')[0] || '',
      hasBubble: !!bubble,
      bubbleText: bubble?.textContent?.trim() || '',
      hasInspector: !!inspector,
    };
  });

  // ── CLICK SECOND AGENT (Draco) ──
  const dracoBtn = page.locator('.agent-sprite').nth(1);
  if (await dracoBtn.count() > 0) {
    await dracoBtn.click({ force: true });
    await page.waitForTimeout(500);
  }

  const afterSwitch = await page.evaluate(() => {
    const selected = document.querySelector('.agent-sprite--selected');
    return {
      selectedAgent: selected?.getAttribute('aria-label')?.split(' — ')[0] || '',
    };
  });

  // ── CLOSE WITH X ──
  const closeBtn = page.locator('.inspector__close');
  if (await closeBtn.count() > 0) {
    await closeBtn.click();
    await page.waitForTimeout(400);
  }
  const afterCloseX = await page.evaluate(() => ({
    inspectorOpen: !!document.querySelector('.inspector'),
  }));

  // ── REOPEN + CLOSE WITH BACKDROP ──
  if (await siriusBtn.count() > 0) {
    await siriusBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
  const backdrop = page.locator('.inspector-backdrop');
  if (await backdrop.count() > 0) {
    await backdrop.click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(400);
  }
  const afterBackdrop = await page.evaluate(() => ({
    inspectorOpen: !!document.querySelector('.inspector'),
  }));

  // ── REOPEN + CLOSE WITH ESCAPE ──
  if (await siriusBtn.count() > 0) {
    await siriusBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const afterEscape = await page.evaluate(() => ({
    inspectorOpen: !!document.querySelector('.inspector'),
  }));

  // ── FOCUS RETURN CHECK ──
  const focusReturn = await page.evaluate(() => {
    const focused = document.activeElement;
    return {
      tagName: focused?.tagName,
      isAgentButton: focused?.classList?.contains('agent-sprite') || false,
    };
  });

  // ── DOM CHECKS ──
  const checks = await page.evaluate(() => {
    const r = {};
    r.overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;

    const top = document.querySelector('.top-nav');
    r.topNav = top ? window.getComputedStyle(top).display : 'missing';

    const bot = document.querySelector('.bottom-nav');
    r.bottomNav = bot ? window.getComputedStyle(bot).display : 'missing';
    r.bottomNavItems = document.querySelectorAll('.bottom-nav__item').length;

    const title = document.querySelector('.app-title');
    r.titleOverflow = title ? title.scrollWidth > title.clientWidth + 2 : null;
    r.titleText = title?.textContent?.trim();

    const img = document.querySelector('.scene-bg__img');
    r.sceneLoaded = img ? (img.complete && img.naturalWidth > 0) : false;

    r.agentCount = document.querySelectorAll('.agent-sprite').length;

    const broken = Array.from(document.querySelectorAll('img'))
      .filter(i => !i.complete || i.naturalWidth === 0)
      .map(i => i.getAttribute('src'));
    r.brokenImages = broken;

    // D-11 check: Capella status dot color
    const capellaDot = document.querySelector('[aria-label*="Capella"] .agent-sprite__status-dot');
    r.capellaDotClass = capellaDot?.className || 'not found';
    if (capellaDot) {
      r.capellaDotColor = window.getComputedStyle(capellaDot).backgroundColor;
    }

    // D-01 check: runtime card clipping
    const runtimeGrid = document.querySelector('.runtime-grid');
    if (runtimeGrid) {
      const cards = runtimeGrid.querySelectorAll('.neon-card');
      const gridRect = runtimeGrid.getBoundingClientRect();
      r.runtimeCardCount = cards.length;
      r.runtimeGridOverflow = runtimeGrid.scrollWidth > runtimeGrid.clientWidth;
      // Check if last card is visible
      const lastCard = cards[cards.length - 1];
      if (lastCard) {
        const lastRect = lastCard.getBoundingClientRect();
        r.lastCardVisible = lastRect.right <= gridRect.right + 2;
      }
    }

    // D-03 check: empty space below scene on tablet
    const officeContainer = document.querySelector('.office-container');
    const appShell = document.querySelector('.app-shell');
    if (officeContainer && appShell) {
      const containerRect = officeContainer.getBoundingClientRect();
      const shellRect = appShell.getBoundingClientRect();
      r.sceneBottomGap = Math.max(0, shellRect.bottom - containerRect.bottom);
    }

    return r;
  });

  const result = {
    initialState,
    afterClick,
    afterSwitch,
    closeX: afterCloseX.inspectorOpen === false ? 'PASS' : 'FAIL',
    closeBackdrop: afterBackdrop.inspectorOpen === false ? 'PASS' : 'FAIL',
    closeEscape: afterEscape.inspectorOpen === false ? 'PASS' : 'FAIL',
    focusReturn,
    ...checks,
    consoleErrors: errors,
  };

  allResults[vp.name] = result;
  console.log(JSON.stringify(result, null, 2));
  await ctx.close();
}

// ── Copy 390x844 as required name ──
const fs = await import('node:fs');
fs.copyFileSync(`${OUT}/mobile-390x844-center.png`, `${OUT}/390x844.png`);

await browser.close();
console.log('\n=== VERIFICATION COMPLETE ===');
console.log(`Screenshots: ${OUT}/`);
console.log('All viewports processed.');
