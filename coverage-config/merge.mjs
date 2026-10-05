import MCR from 'monocart-coverage-reports';
import { mergedOptions } from './options.mjs';

await MCR(mergedOptions).generate();
