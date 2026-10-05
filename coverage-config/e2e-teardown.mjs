import MCR from 'monocart-coverage-reports';
import { e2eOptions } from './options.mjs';

export default async function globalTeardown() {
  await MCR(e2eOptions).generate();
}
