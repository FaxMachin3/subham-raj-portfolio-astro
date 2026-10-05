import MCR from 'monocart-coverage-reports';
import { unitOptions } from './options.mjs';

/** Vitest globalSetup: clear the cache before the run, write the raw report after it. */
export default function globalSetup() {
  MCR(unitOptions).cleanCache();
  return async () => {
    await MCR(unitOptions).generate();
  };
}
