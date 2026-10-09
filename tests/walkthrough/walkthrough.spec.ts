import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * One continuous, assertion-driven tour of every page, flow and control, recorded per device. A caption
 * names the step being verified; taps and key presses are drawn so the video shows exactly what happened.
 */

async function installOverlay(page: Page) {
  await page.addInitScript(() => {
    const mount = () => {
      const caption = document.createElement('div');
      caption.id = 'wt-caption';
      caption.setAttribute('aria-hidden', 'true');
      Object.assign(caption.style, {
        position: 'fixed',
        left: '10px',
        bottom: '74px',
        zIndex: '2147483647',
        maxWidth: 'min(560px, 70vw)',
        padding: '6px 10px',
        borderRadius: '8px',
        background: 'rgba(17,17,17,.88)',
        color: '#fff',
        font: '600 13px/1.35 ui-monospace, monospace',
        pointerEvents: 'none',
      });
      caption.textContent = sessionStorage.getItem('wt-caption') ?? '';
      document.documentElement.append(caption);
      addEventListener(
        'pointerdown',
        (e) => {
          const dot = document.createElement('div');
          Object.assign(dot.style, {
            position: 'fixed',
            left: `${e.clientX - 18}px`,
            top: `${e.clientY - 18}px`,
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '3px solid #2b59c3',
            background: 'rgba(43,89,195,.15)',
            zIndex: '2147483647',
            pointerEvents: 'none',
            transition: 'transform .4s, opacity .4s',
          });
          document.documentElement.append(dot);
          requestAnimationFrame(() => Object.assign(dot.style, { transform: 'scale(1.6)', opacity: '0' }));
          setTimeout(() => dot.remove(), 450);
        },
        true,
      );
      addEventListener(
        'keydown',
        (e) => {
          const cap = document.createElement('div');
          cap.textContent = e.key === ' ' ? 'Space' : e.key;
          Object.assign(cap.style, {
            position: 'fixed',
            right: '14px',
            bottom: '74px',
            padding: '6px 12px',
            borderRadius: '8px',
            background: '#1d1d1b',
            color: '#fff',
            font: '700 15px ui-monospace, monospace',
            zIndex: '2147483647',
            border: '1px solid #444',
            borderBottomWidth: '4px',
            pointerEvents: 'none',
          });
          document.documentElement.append(cap);
          setTimeout(() => cap.remove(), 650);
        },
        true,
      );
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
  });
}

test('walkthrough: every page, flow and control', async ({ page, isMobile, context, browserName }) => {
  const touch = isMobile;
  const step = async (title: string, body: () => Promise<void>) =>
    test.step(title, async () => {
      await page.evaluate((t) => {
        sessionStorage.setItem('wt-caption', t);
        const el = document.getElementById('wt-caption');
        if (el) el.textContent = t;
      }, title);
      await body();
    });
  const press = (target: Locator) => (touch ? target.tap() : target.click());
  const see = async (target: Locator) => {
    await target.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await page.waitForTimeout(700);
  };
  const scroll = (by: number) => page.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), by);
  const card = (id: string) => page.getByTestId(`fix-${id}`);
  const status = (id: string) => card(id).getByTestId('status');

  await installOverlay(page);
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Break this site' })).toBeEnabled();

  await step('Home · header, wordmark and hero copy', async () => {
    await expect(page.getByRole('link', { name: 'Subham Raj, home' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      /I make broken interfaces\s+fast, accessible and global\./,
    );
    await expect(page.getByRole('link', { name: 'Explore the interactive lab ↓' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Résumé' }).first()).toBeVisible();
    if (!touch) {
      for (const name of ['Work', 'The fixes', 'Experience'])
        await expect(page.getByRole('link', { name, exact: true }).first()).toBeVisible();
    }
    await page.waitForTimeout(800);
  });

  if (!touch) {
    await step('Keyboard · skip link moves focus to the main content', async () => {
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('#main')).toBeFocused();
    });
  }

  await step('Theme · dark, light, then back to system', async () => {
    const html = page.locator('html');
    // The reveal's view-transition layer takes pointer events until it finishes.
    const settled = async () => {
      await expect(html).not.toHaveClass(/theme-transition/);
      await page.waitForTimeout(600);
    };
    const cycle = page.locator('.theme-cycle');
    if (await cycle.isVisible()) {
      for (const theme of ['light', 'dark']) {
        await press(cycle);
        await expect(html).toHaveAttribute('data-theme', theme);
        await settled();
      }
      await press(cycle);
    } else {
      for (const [name, theme] of [
        ['Dark theme', 'dark'],
        ['Light theme', 'light'],
      ] as const) {
        await press(page.getByTitle(name));
        await expect(page.getByRole('radio', { name })).toBeChecked();
        await expect(html).toHaveAttribute('data-theme', theme);
        await settled();
      }
      await press(page.getByTitle('System theme'));
      await expect(page.getByRole('radio', { name: 'System theme' })).toBeChecked();
    }
    await expect(html).not.toHaveAttribute('data-theme', /.+/);
    await settled();
  });

  await step('Explore the interactive lab · the console sits directly above the cards', async () => {
    await press(page.getByRole('link', { name: 'Explore the interactive lab ↓' }));
    await expect(page.getByText('This page is a working demo.')).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Break this site' })).toBeInViewport();
    await page.waitForTimeout(900);
  });

  await step('Break this site · six issues break, the headline breaks word by word', async () => {
    await press(page.getByRole('button', { name: 'Break this site' }));
    await expect(page.locator('.toast--visible')).toContainText('Breaking the site.');
    await expect(page.getByRole('button', { name: 'Let Subham fix it' })).toBeEnabled({ timeout: 90_000 });
    for (const word of ['fast', 'accessible', 'global'])
      await expect(page.locator('html')).toHaveAttribute(`data-${word}`, 'broken');
    await expect
      .poll(() => page.locator('.word--global').evaluate((el) => getComputedStyle(el, '::after').visibility))
      .toBe('visible');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(1500);
  });

  await step('“See what broke” · every card reports Broken with a measured “before”', async () => {
    await press(page.getByRole('link', { name: 'See what broke ↓' }));
    for (const id of ['plot', 'jank', 'bundle', 'network', 'a11y', 'i18n']) {
      await see(card(id));
      await expect(status(id)).toHaveText('Broken');
      await expect(card(id).getByTestId('metric-before')).not.toHaveText('—');
    }
  });

  await step('Let Subham fix it · six commits with x-rays, words heal, PR merges', async () => {
    await see(page.locator('.lab'));
    await press(page.getByRole('button', { name: 'Let Subham fix it' }));
    await expect(page.locator('.toast--visible')).toContainText('Commit 1/6');
    await expect(page.locator('html')).toHaveAttribute('data-accessible', 'healed', { timeout: 60_000 });
    await expect(page.getByTestId('pr-badge')).toHaveText('Merged', { timeout: 150_000 });
    await expect(page.locator('html')).toHaveAttribute('data-fast', 'healed');
    await expect(page.getByRole('link', { name: 'See your results ↓' })).toBeVisible();
  });

  await step('Results · before, after and production for every fix', async () => {
    await press(page.getByRole('link', { name: 'See your results ↓' }));
    const rows = page.locator('.results tbody tr');
    await expect(rows).toHaveCount(6);
    for (let i = 0; i < 6; i++) await expect(rows.nth(i).locator('td.after')).not.toHaveText('—');
    await page.waitForTimeout(1200);
  });

  for (const id of ['plot', 'jank', 'bundle', 'network', 'a11y', 'i18n']) {
    await step(`Fix card ${id} · Break plays the full x-ray, then the measured run`, async () => {
      await see(card(id).locator('.fix-card__demo'));
      await press(card(id).getByRole('button', { name: 'Break', exact: true }));
      await expect(card(id).getByTestId('xray')).toBeVisible();
      await expect(card(id).getByTestId('xray-caption')).not.toBeEmpty();
      await expect(status(id)).toHaveText('Broken', { timeout: 60_000 });
    });
    await step(`Fix card ${id} · Fix, skipping its x-ray`, async () => {
      await press(card(id).getByRole('button', { name: 'Fix', exact: true }));
      await page.waitForTimeout(900);
      await press(card(id).getByRole('button', { name: 'Skip' }));
      await expect(status(id)).toHaveText('Fixed ✓', { timeout: 60_000 });
    });
  }

  await step('Fix 02 · Toggle sidebar opens and closes it', async () => {
    await see(card('jank'));
    const app = card('jank').locator('.jank-app');
    const toggle = card('jank').getByRole('button', { name: 'Toggle sidebar' });
    // The measured Fix run leaves the sidebar open.
    await expect(app).toHaveClass(/jank-app--open/);
    await press(toggle);
    await expect(app).not.toHaveClass(/jank-app--open/);
    await page.waitForTimeout(700);
    await press(toggle);
    await expect(app).toHaveClass(/jank-app--open/);
    await expect(card('jank').locator('.fix-card__note')).toContainText('Last run:');
  });

  await step('Fix 03 · each route loads only when opened', async () => {
    await see(card('bundle').locator('.route-buttons'));
    for (const route of ['admin', 'graph', 'reports', 'search', 'settings']) {
      await press(card('bundle').getByRole('button', { name: `Open ${route}` }));
      await expect(card('bundle').getByRole('button', { name: new RegExp(`^${route} · `) })).toBeDisabled();
    }
  });

  await step('Fix 04 · panels load as the list scrolls', async () => {
    await see(card('network'));
    const fetched = card('network').locator('.network-stats strong').nth(1);
    const before = Number(await fetched.textContent());
    await card('network')
      .getByRole('list', { name: 'Entity panels, scrollable' })
      .evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
    await expect.poll(async () => Number(await fetched.textContent())).toBeGreaterThan(before);
  });

  await step('Fix 05 · Filter menu, Export CSV, More actions', async () => {
    const region = page.getByTestId('a11y-region');
    await see(region);
    await press(region.getByRole('button', { name: 'Filter' }));
    await press(region.getByRole('menuitemradio', { name: 'High risk' }));
    await expect(region.locator('tbody tr')).toHaveCount(2);
    await expect(region.getByRole('status')).toHaveText('Showing 2 high-risk.');
    const download = page.waitForEvent('download');
    await press(region.getByRole('button', { name: 'Export' }));
    expect((await download).suggestedFilename()).toBe('linked-addresses.csv');
    await press(region.getByRole('button', { name: 'More actions' }));
    await press(region.getByRole('menuitem', { name: 'Reset table' }));
    await expect(region.locator('tbody tr')).toHaveCount(4);
  });

  if (!touch) {
    await step('Fix 05 · keyboard: W/S rows, A/D headers, arrows cells, Enter sorts', async () => {
      const region = page.getByTestId('a11y-region');
      await region.getByRole('cell', { name: '0x9f…a21' }).click();
      for (const key of ['d', 'd', 'Enter', 's', 's', 'ArrowRight', 'ArrowRight', 'w']) {
        await page.keyboard.press(key);
        await page.waitForTimeout(250);
      }
      await expect(region.getByRole('columnheader', { name: /Type/ })).toHaveAttribute(
        'aria-sort',
        'ascending',
      );
      await expect(region.locator('tbody tr').nth(1)).toBeFocused();
      await page.keyboard.press('w');
      await expect(region.locator('tbody tr').first()).toBeFocused();
      await page.keyboard.press('w');
      await expect(region.getByRole('columnheader').nth(2)).toBeFocused();
      await region.getByRole('button', { name: 'Filter' }).focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(region.locator('tbody tr')).toHaveCount(2);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Home');
      await page.keyboard.press('Enter');
      await expect(region.locator('tbody tr')).toHaveCount(4);
    });
  }

  await step('Fix 06 · every language, English from the bundle, repeats from cache', async () => {
    await see(card('i18n'));
    const select = page.getByLabel('Language');
    for (const code of ['es', 'pt', 'hi', 'ja', 'zh']) {
      await select.selectOption(code);
      await expect(page.getByTestId('i18n-note')).toContainText(`${code}.json`);
      await page.waitForTimeout(350);
    }
    await select.selectOption('en');
    await expect(page.getByTestId('i18n-panel').locator('h4')).toHaveText('Investigation overview');
    await select.selectOption('ja');
    await expect(page.getByTestId('i18n-note')).toHaveText('ja.json · from cache, 0 requests');
    await select.selectOption('en');
  });

  await step('Sections · case studies, leverage, experience, contact', async () => {
    for (const id of ['#work', '#leverage', '#experience', '#contact']) {
      await see(page.locator(id));
      await expect(page.locator(id).getByRole('heading', { level: 2 })).toBeVisible();
    }
    const contact = page.locator('#contact');
    await expect(contact.getByRole('link', { name: 'Email me' })).toHaveAttribute('href', /^mailto:/);
    await expect(contact.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', /linkedin\.com/);
    await expect(contact.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', /github\.com/);
    const pdf = await page.request.get(
      (await contact.getByRole('link', { name: 'Résumé (PDF)' }).getAttribute('href'))!,
    );
    expect(pdf.headers()['content-type']).toContain('pdf');
  });

  const studies = [
    'Making an investigation graph interactive at scale',
    'An accessible design system, proposed and adopted',
    'The chat UI for Orion, TRM’s AI investigation assistant',
    'Guardrails that make a whole team faster',
  ];
  for (const title of studies) {
    await step(`Case study · ${title}`, async () => {
      const link = page.getByRole('link', { name: new RegExp(title.slice(0, 20)) }).first();
      await see(link);
      await press(link);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title.replace('’', "'"));
      await expect(page.getByRole('navigation', { name: 'Next case study' })).toBeVisible();
      await scroll(900);
      await page.waitForTimeout(700);
      await page.goBack();
      await expect(page.getByRole('heading', { level: 1 })).toContainText('I make broken interfaces');
    });
  }

  await step('Résumé page · roles, skills, PDF download', async () => {
    await press(page.getByRole('link', { name: 'Résumé' }).first());
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Subham Raj');
    await expect(page.getByText('Open to remote roles')).toBeVisible();
    for (const company of ['TRM Labs', 'Paytm', 'Enterprise Minds', 'Infosys'])
      await expect(page.getByText(company, { exact: false }).first()).toBeVisible();
    await scroll(1200);
    await page.waitForTimeout(700);
    const href = await page.getByRole('link', { name: 'Download PDF' }).getAttribute('href');
    expect((await page.request.get(href!)).status()).toBe(200);
  });

  await step('404 page · friendly message and a way home', async () => {
    await page.goto('/this-page-does-not-exist');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('This one isn’t broken on purpose.');
    await page.waitForTimeout(800);
    await press(page.getByRole('link', { name: 'Subham Raj, home' }));
    await expect(page).toHaveURL(/\/$/);
  });

  await step('Done · every page, flow and control verified on this device', async () => {
    await page.waitForTimeout(1500);
  });
});
