import MCR from 'monocart-coverage-reports';
import { e2eOptions } from './options.mjs';

export default async function globalSetup() {
  MCR(e2eOptions).cleanCache();
}
