import { q, render, type Scene } from '../runtime';

export const i18nScene: Scene = {
  label: { broken: 'untyped translation keys', fixed: 'generated key types, checked in CI' },

  async play({ root, phase, wait, caption, counter }) {
    const fixed = phase === 'fixed';
    render(
      root,
      `<div class="xr-i18n">
        <div class="xr-code">
          ${fixed ? '<span class="xr-dim">type I18nKey = <span class="xr-str">\'alerts.title\'</span> | …</span>' : '<span class="xr-dim">t(key: string)</span>'}
          <span data-line>t(<span class="xr-str" data-key>'alerts.titel'</span>)</span>
          <span class="xr-err" data-err hidden>'alerts.titel' is not an I18nKey. Did you mean 'alerts.title'?</span>
        </div>
        <div class="xr-code xr-json">
          <span data-k>"summary": "調査の概要"</span>
          <span data-k>"alerts.title": "3 件のアラート"</span>
          <span data-k>"updated": "更新: 2 分前"</span>
        </div>
        <div class="xr-preview">
          <span class="xr-k">ja preview</span>
          <span data-preview>…</span>
          <span class="xr-build" data-build>build: –</span>
        </div>
      </div>`,
    );
    const line = q(root, '[data-line]');
    const preview = q(root, '[data-preview]');
    const build = q(root, '[data-build]');
    const setBuild = (text: string, ok: boolean) => {
      build.textContent = text;
      build.className = `xr-build xr-build--${ok ? 'pass' : 'fail'}`;
    };
    line.classList.add('xr-line--hl');

    if (!fixed) {
      caption('Keys are plain strings, so the typo “alerts.titel” is just a string.');
      counter('missing strings', '0');
      await wait(700);
      caption('At runtime, the lookup misses in ja.json…');
      for (const key of root.querySelectorAll<HTMLElement>('[data-k]')) {
        key.classList.add('xr-find');
        await wait(260);
        key.classList.remove('xr-find');
      }
      preview.innerHTML = '<span class="xr-raw">{{alerts.titel}}</span>';
      setBuild('build ✓ passed (nothing checked the key)', true);
      counter('missing strings', '1');
      caption('…so users see the raw key, and the build still passed.');
      await wait(900);
      return;
    }

    caption('The fix generates a key type from the locale files.');
    counter('missing strings', '1');
    await wait(700);
    q(root, '[data-key]').classList.add('xr-squiggle');
    q(root, '[data-err]').hidden = false;
    setBuild('CI ✗ type check failed', false);
    caption('The typo is now a compile error, caught in review.');
    await wait(1300);
    q(root, '[data-err]').hidden = true;
    const key = q(root, '[data-key]');
    key.classList.remove('xr-squiggle');
    key.textContent = "'alerts.title'";
    setBuild('CI ✓ passed', true);
    preview.innerHTML = '<span class="xr-ok">3 件のアラート</span>';
    counter('missing strings', '0');
    caption('Fixed before shipping. Locales also load lazily, then from cache.');
    await wait(700);
  },
};
