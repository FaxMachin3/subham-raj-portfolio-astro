import { useEffect, useRef, useState } from 'react';
import FixCard from '../FixCard';
import { useFixLifecycle } from '@/fixes/useFixLifecycle';
import { importCounted } from '@/lab/requests';
import { formatMs } from '@/lab/format';
import { I18N_KEYS, type I18nKey } from '@/i18n/keys.gen';
import en from '@/i18n/en.json';
import type { Measurement } from '@/fixes/types';

type Dictionary = Record<I18nKey, string>;
const loaders = import.meta.glob<Dictionary>(['../../../i18n/*.json', '!../../../i18n/en.json'], {
  import: 'default',
});
const loaderFor = (lang: string) => loaders[`../../../i18n/${lang}.json`];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
] as const;

export default function I18nFix({ method }: { method?: string }) {
  const [lang, setLang] = useState('en');
  const [dict, setDict] = useState<Dictionary | null>(en);
  // The language the panel is actually showing; the menu can be ahead of it while a dictionary loads.
  const [shown, setShown] = useState('en');
  const shownRef = useRef('en');
  const [note, setNote] = useState('en · bundled with the page');
  const cache = useRef(new Map<string, Dictionary>());
  // Every pick gets an id: a slower, earlier load must not overwrite a later pick, even of the same language
  // (a load started in fixed mode must not translate the panel after a switch to broken mode).
  const requestId = useRef(0);
  const modeRef = useRef<'broken' | 'fixed'>('fixed');

  useEffect(() => {
    const abandon = () => requestId.current++;
    addEventListener('pagehide', abandon);
    return () => {
      removeEventListener('pagehide', abandon);
      abandon();
    };
  }, []);

  const show = (code: string, next: Dictionary | null, message: string) => {
    shownRef.current = code;
    setShown(code);
    setDict(next);
    setNote(message);
  };

  /** Applies a language and returns how many strings are missing in it. Rejects if it can't be loaded. */
  const apply = async (code: string, signal?: AbortSignal): Promise<number> => {
    const id = ++requestId.current;
    const mode = modeRef.current;
    const current = () => requestId.current === id && modeRef.current === mode && !signal?.aborted;
    setLang(code);
    if (code === 'en') {
      show('en', en, 'en · bundled with the page');
      return 0;
    }
    if (modeRef.current === 'broken') {
      // Raw keys are English identifiers, so the panel stays marked as English.
      show('en', null, 'no i18n system · keys rendered raw');
      return I18N_KEYS.length;
    }
    const cached = cache.current.get(code);
    if (cached) {
      show(code, cached, `${code}.json · from cache, 0 requests`);
      return 0;
    }
    const start = performance.now();
    try {
      const { result: loaded, fetched } = await importCounted(code, loaderFor(code)!);
      cache.current.set(code, loaded);
      if (current()) {
        const how = fetched
          ? `loaded in ${formatMs(performance.now() - start)}`
          : 'already in memory, 0 requests';
        show(code, loaded, `${code}.json · ${how}`);
      }
      return I18N_KEYS.filter((k) => !loaded[k]).length;
    } catch (error) {
      if (current()) {
        // Put the menu back on the language the panel is still showing.
        setLang(shownRef.current);
        setNote(`couldn’t load ${code}.json · try again`);
      }
      throw error;
    }
  };

  const measure = async (mode: 'broken' | 'fixed', signal: AbortSignal): Promise<Measurement> => {
    modeRef.current = mode;
    if (mode === 'fixed') cache.current.clear();
    const code = lang === 'en' ? 'hi' : lang;
    const missing = await apply(code, signal);
    return {
      value: missing,
      unit: 'missing',
      display: `${missing} of ${I18N_KEYS.length}`,
      detail: `missing strings in ${LANGUAGES.find((l) => l.code === code)!.label}`,
      supported: true,
    };
  };

  useFixLifecycle('i18n', {
    break: (signal) => measure('broken', signal),
    fix: (signal) => measure('fixed', signal),
  });

  const text = (key: I18nKey) => (dict?.[key] ? dict[key] : <span className="raw-key">{`{{${key}}}`}</span>);

  return (
    <FixCard
      id="i18n"
      method={method}
      number="06"
      area="internationalization"
      title="A product that only speaks English"
      description="Broken: strings are hard-coded, so switching language shows raw keys. Fixed: typed keys, and translations that load the first time a language is picked, then come from cache."
      measureLabel={{ before: 'missing strings', after: 'missing strings' }}
      productionNote="Led frontend internationalization at TRM Labs: typed keys, lazy-loaded translations, and pre-commit and CI checks that flag missing translation keys before merge."
    >
      <div className="i18n-controls">
        <label htmlFor="i18n-lang" className="mono">
          Language
        </label>
        <select id="i18n-lang" value={lang} onChange={(e) => apply(e.target.value).catch(() => {})}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <span className="mono i18n-note" data-testid="i18n-note">
          {note}
        </span>
      </div>
      <div className="i18n-panel" key={shown} lang={shown} data-testid="i18n-panel">
        <h4>{text('title')}</h4>
        <p>{text('sub')}</p>
        <div className="i18n-panel__chips">
          <span className="primary">{text('open')}</span>
          <span>{text('alerts')}</span>
          <span>{text('updated')}</span>
        </div>
      </div>
      <pre className="type-snippet" aria-label="Generated TypeScript type for translation keys">
        {`// generated from en.json, checked in CI\ntype I18nKey = ${I18N_KEYS.map((k) => `'${k}'`).join(' | ')};`}
      </pre>
    </FixCard>
  );
}
