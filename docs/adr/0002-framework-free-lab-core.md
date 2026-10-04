# 0002 · Framework-free lab core

**Status:** accepted

## Context

The demos measure real things: frame times, long tasks, layout shift, request rates, contrast ratios, plot
algorithm cost. If that logic lived inside React components it would be hard to test and tied to one
framework.

## Decision

All workloads and measurements live in `src/lab` as plain TypeScript functions with no framework imports:
`plot`, `frames`, `idle`, `contrast`, `audit`, `requests` and `observers`. Islands call them; they never call
islands.

Each demo talks to the shared store only through `useFixLifecycle(id, { break, fix })`. The controller sets a
target (`broken` or `healthy`) with a nonce; each card reconciles towards it. A newer request aborts the
previous run through an `AbortSignal`, and a card that hydrates late still catches up to the current target.

## Consequences

- The lab core is unit tested in Vitest without a browser (jsdom only where the DOM is the subject).
- Demos are independent: adding a seventh means one lab module, one island and one registry entry.
- Every handler must honour its `AbortSignal` so "Fix" can interrupt "Break" without leaking work.
