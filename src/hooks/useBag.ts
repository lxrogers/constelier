'use client';

import { useSyncExternalStore } from 'react';
import { MAX_BAG_ITEMS, MAX_QUANTITY, type BagItem } from '@/lib/commerce/design';

// The bag lives in localStorage, so it survives reloads and is shared by every
// tab. Prices in it are for display; checkout re-prices on the server.

const KEY = 'constelier-bag-v1';
const EMPTY: BagItem[] = [];
const listeners = new Set<() => void>();
let cache: BagItem[] | null = null;

function read(): BagItem[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(items: BagItem[]) {
  cache = items;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage full or blocked: keep the in-memory bag for this tab.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) { cache = null; listener(); }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export const bag = {
  add(item: Omit<BagItem, 'id' | 'addedAt' | 'quantity'>) {
    const items = read();
    if (items.length >= MAX_BAG_ITEMS) throw new Error(`Your bag holds up to ${MAX_BAG_ITEMS} pendants.`);
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
    write([...items, { ...item, id, quantity: 1, addedAt: Date.now() }]);
    return id;
  },
  remove(id: string) {
    write(read().filter((i) => i.id !== id));
  },
  setQuantity(id: string, quantity: number) {
    const q = Math.max(1, Math.min(MAX_QUANTITY, Math.round(quantity)));
    write(read().map((i) => (i.id === id ? { ...i, quantity: q } : i)));
  },
  clear() {
    write([]);
  },
};

export function useBag() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);
  const count = items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = items.reduce((n, i) => n + i.unitAmount * i.quantity, 0);
  return { items, count, subtotal };
}

export { formatUSD } from '@/lib/commerce/format';
