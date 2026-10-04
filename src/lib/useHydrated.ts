import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/**
 * False during server rendering and hydration, true afterwards. Use it to gate values that only exist
 * in the browser (store state written by other islands, Performance APIs), so the first client render
 * matches the server HTML.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
