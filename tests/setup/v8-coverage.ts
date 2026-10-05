import { Session } from 'node:inspector/promises';
import { fileURLToPath } from 'node:url';
import { afterAll } from 'vitest';
import MCR from 'monocart-coverage-reports';
import { isUnitEntry, unitOptions } from '../../coverage-config/options.mjs';

/**
 * With COVERAGE=1, collects raw V8 coverage for each test file through the inspector, in a format that merges
 * with the browser coverage (coverage-config/). Coverage starts when this setup file loads, before the test
 * file's imports run, so module top-level code counts too.
 */

// Vite wraps modules, so the map comment is followed by the wrapper's closing braces, not end of input.
const INLINE_MAP =
  /\/\/# sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,([A-Za-z0-9+/=]+)/;

/**
 * Code Vite's SSR wrapper adds around a module, which never appears in the source: `catch {}` guards, the
 * `import.meta.env` fallback, and a live-binding getter per export (`() => { try { return X } catch {} }`).
 */
const WRAPPER_CODE =
  /^(catch \{\}|\?\? __vite_ssr_import_meta__|\(\) => \{ try \{ return [\w$]+ \} catch \{\} \})/;

type Range = { startOffset: number; endOffset: number; count: number };
type ScriptCoverage = { url: string; scriptId: string; functions: { ranges: Range[] }[] };

/** Vite's inline maps name the source by basename only; point them at the real file so paths merge. */
function withAbsoluteSources(source: string, file: string): string {
  const match = source.match(INLINE_MAP);
  if (!match) return source;
  const map = JSON.parse(Buffer.from(match[1]!, 'base64').toString('utf8'));
  map.sources = [file];
  map.sourceRoot = '';
  const encoded = Buffer.from(JSON.stringify(map)).toString('base64');
  return source.replace(INLINE_MAP, `//# sourceMappingURL=data:application/json;base64,${encoded}`);
}

/** Wrapper-only ranges would otherwise map onto real source lines and read as untested code. */
function withoutWrapperGaps(entry: ScriptCoverage, source: string): ScriptCoverage {
  const functions = entry.functions.map((fn) => ({
    ...fn,
    ranges: fn.ranges.map((r) =>
      r.count === 0 && WRAPPER_CODE.test(source.slice(r.startOffset, r.endOffset)) ? { ...r, count: 1 } : r,
    ),
  }));
  return { ...entry, functions };
}

if (process.env.COVERAGE === '1') {
  const session = new Session();
  session.connect();
  await session.post('Profiler.enable');
  await session.post('Debugger.enable');
  await session.post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });

  afterAll(async () => {
    const { result } = (await session.post('Profiler.takePreciseCoverage')) as { result: ScriptCoverage[] };
    await session.post('Profiler.stopPreciseCoverage');
    const entries = [];
    for (const entry of result.filter(isUnitEntry)) {
      const { scriptSource } = await session.post('Debugger.getScriptSource', { scriptId: entry.scriptId });
      entries.push({
        ...withoutWrapperGaps(entry, scriptSource),
        source: withAbsoluteSources(scriptSource, fileURLToPath(entry.url)),
      });
    }
    await MCR(unitOptions).add(entries);
  });
}
