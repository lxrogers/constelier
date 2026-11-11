'use client';

import { useEffect } from 'react';
import { bag } from '@/hooks/useBag';

// The order went through, so empty the bag on this device.
export default function ClearBag() {
  useEffect(() => { bag.clear(); }, []);
  return null;
}
