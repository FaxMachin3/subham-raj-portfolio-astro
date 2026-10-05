import type { FixId } from '@/fixes/types';
import type { Scene } from '../runtime';
import { a11yScene } from './a11y';
import { bundleScene } from './bundle';
import { i18nScene } from './i18n';
import { jankScene } from './jank';
import { networkScene } from './network';
import { plotScene } from './plot';

export const SCENES: Record<FixId, Scene> = {
  plot: plotScene,
  jank: jankScene,
  bundle: bundleScene,
  network: networkScene,
  a11y: a11yScene,
  i18n: i18nScene,
};
