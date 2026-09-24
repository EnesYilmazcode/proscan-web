// Sorts rows the way the board's table does, for rows the table never
// held (the full export). Uses the same accessors, with missing values last.

import type { SortingState } from '@tanstack/react-table';
import type { Product } from '../../lib/types';
import { boardColumns } from './columns';

type Accessor = (p: Product) => unknown;

function accessorOf(id: string): Accessor | null {
  const col = boardColumns.find((c) => c.id === id) as { accessorFn?: (p: Product, i: number) => unknown } | undefined;
  return col?.accessorFn ? (p) => col.accessorFn!(p, 0) : null;
}

export function sortRows(rows: Product[], sorting: SortingState): Product[] {
  const keys = sorting
    .map((s) => ({ get: accessorOf(s.id), desc: s.desc }))
    .filter((k): k is { get: Accessor; desc: boolean } => k.get !== null);
  if (keys.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const { get, desc } of keys) {
      const x = get(a);
      const y = get(b);
      if (x === y) continue;
      if (x === undefined || x === null) return 1;
      if (y === undefined || y === null) return -1;
      const cmp = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y) : (x as number) < (y as number) ? -1 : 1;
      return desc ? -cmp : cmp;
    }
    return 0;
  });
}
