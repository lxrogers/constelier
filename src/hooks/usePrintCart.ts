'use client';

import { useCallback, useEffect, useState } from 'react';
import { PRINT_CART_KEY, type PrintItem } from '@/lib/print-cart';

// Lab print cart, kept in localStorage so it survives reloads.
export function usePrintCart() {
  const [items, setItems] = useState<PrintItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRINT_CART_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = useCallback((next: PrintItem[]) => {
    setItems(next);
    try { localStorage.setItem(PRINT_CART_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const add = useCallback((item: Omit<PrintItem, 'id' | 'addedAt'>) => {
    setItems((prev) => {
      const next = [...prev, { ...item, id: Math.random().toString(36).slice(2, 10), addedAt: Date.now() }];
      try { localStorage.setItem(PRINT_CART_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => persist(items.filter((i) => i.id !== id)), [items, persist]);
  const clear = useCallback(() => persist([]), [persist]);

  return { items, add, remove, clear };
}
