// FROZEN evaluator (graph.md → N1). Test environment for the front-end (jsdom).
import { webcrypto } from 'node:crypto';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom has no SubtleCrypto; the kernel needs the real one.
if (!globalThis.crypto?.subtle) vi.stubGlobal('crypto', webcrypto);

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

// No canvas in jsdom: components must cope with a null 2D context.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// Tests run with "prefers-reduced-motion: reduce": animations (typewriter, starfield, tickers)
// must render their final state immediately.
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: /prefers-reduced-motion:\s*reduce/.test(query),
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
}));

Element.prototype.scrollIntoView = () => {};
Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => {}) }, configurable: true });

afterEach(() => {
  cleanup();
  localStorage.clear();
});
