import { memoryStorage, type StorageLike } from '../storage/localStore';

export interface TestStorage extends StorageLike {
  /** Make every following setItem whose key matches throw a QuotaExceededError. */
  failWritesTo(match: (key: string) => boolean): void;
  dump(): Record<string, string>;
}

export function testStorage(initial: Record<string, string> = {}): TestStorage {
  const inner = memoryStorage();
  for (const [key, value] of Object.entries(initial)) inner.setItem(key, value);
  let shouldFail: (key: string) => boolean = () => false;
  return {
    get length() {
      return inner.length;
    },
    key: (i) => inner.key(i),
    getItem: (key) => inner.getItem(key),
    removeItem: (key) => {
      inner.removeItem(key);
    },
    setItem: (key, value) => {
      if (shouldFail(key)) throw new DOMException('quota', 'QuotaExceededError');
      inner.setItem(key, value);
    },
    failWritesTo: (match) => {
      shouldFail = match;
    },
    dump: () => {
      const out: Record<string, string> = {};
      for (let i = 0; i < inner.length; i++) {
        const key = inner.key(i);
        if (key !== null) out[key] = inner.getItem(key) ?? '';
      }
      return out;
    },
  };
}
