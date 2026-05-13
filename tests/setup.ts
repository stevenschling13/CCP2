import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

Element.prototype.scrollIntoView = vi.fn();

Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  configurable: true,
});
