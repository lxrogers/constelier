'use client';

import { formatPosition, formatHouse } from '@/modules/prototypes/big3-ring';
import type { Big3 } from '../types';

export default function Big3Summary({ big3 }: { big3: Big3 | null }) {
  if (!big3) return null;
  const rows = [
    { name: 'Rising', where: formatPosition(big3.asc), extra: '' },
    { name: 'Sun', where: formatPosition(big3.sun), extra: formatHouse(big3.sun) },
    { name: 'Moon', where: formatPosition(big3.moon), extra: formatHouse(big3.moon) },
  ];
  return (
    <dl className="b3-summary">
      {rows.map(r => (
        <div key={r.name}>
          <dt>{r.name}</dt>
          <dd>{r.where}{r.extra && <span> &middot; {r.extra}</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
