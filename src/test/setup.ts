// jsdom lacks layout APIs that React Flow relies on (SPEC §12). Provide minimal stand-ins.
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// first ELK layout loads a large bundle; give async queries room when files run in parallel
configure({ asyncUtilTimeout: 10_000 });

afterEach(() => {
  cleanup();
});

class ResizeObserverMock implements ResizeObserver {
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element): void {
    const rect = target.getBoundingClientRect();
    const entry = { target, contentRect: rect } as unknown as ResizeObserverEntry; // minimal entry for React Flow
    this.callback([entry], this);
  }
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = ResizeObserverMock;

class DOMMatrixReadOnlyMock {
  m22: number;
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([0-9.]+)\)/)?.[1];
    this.m22 = scale !== undefined ? Number(scale) : 1;
  }
}
// React Flow only reads m22 (zoom) from the transform
globalThis.DOMMatrixReadOnly = DOMMatrixReadOnlyMock as unknown as typeof DOMMatrixReadOnly;

const FALLBACK_WIDTH = 1024;
const FALLBACK_HEIGHT = 768;
Object.defineProperties(HTMLElement.prototype, {
  offsetWidth: {
    configurable: true,
    get(this: HTMLElement) {
      return Number.parseFloat(this.style.width) || FALLBACK_WIDTH;
    },
  },
  offsetHeight: {
    configurable: true,
    get(this: HTMLElement) {
      return Number.parseFloat(this.style.height) || FALLBACK_HEIGHT;
    },
  },
});

SVGGraphicsElement.prototype.getBBox = function getBBox(): DOMRect {
  return { x: 0, y: 0, width: 0, height: 0 } as DOMRect; // jsdom has no SVG geometry
};
