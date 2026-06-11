// Virtualized delta-board table: TanStack Table v8 headless core +
// @tanstack/react-virtual rows at the 38px instrument density. The card
// scrolls internally so the sticky thead works and the virtualizer has a
// stable scroll element; spacer rows preserve native <table> layout
// (every data row is exactly --row-height tall — see board.css).

import { useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { clsx } from 'clsx';
import { flexRender, type Table as TableInstance } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Product } from '../../lib/types';
import './board.css';

const ROW_HEIGHT = 38; // px — must match --row-height in tokens.css
const OVERSCAN = 12;

export interface BoardTableProps {
  table: TableInstance<Product>;
  /** Row click / Enter — opens the history drawer via ?asin=. */
  onOpen: (asin: string) => void;
}

export default function BoardTable({ table, onOpen }: BoardTableProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rows = table.getRowModel().rows;
  const colCount = table.getVisibleLeafColumns().length;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const padTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const padBottom =
    virtualRows.length > 0
      ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  const onRowClick = (e: MouseEvent<HTMLTableRowElement>, asin: string) => {
    // Controls inside cells (ASIN copy, etc.) handle themselves.
    if ((e.target as Element).closest('button, a, input, select')) return;
    onOpen(asin);
  };

  const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, asin: string) => {
    if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(asin);
  };

  return (
    <div className="board-card">
      <div className="board-scroll" ref={scrollRef}>
        <table className="board-table">
          <colgroup>
            {table.getVisibleLeafColumns().map((c) => (
              <col key={c.id} style={{ width: c.columnDef.meta?.width }} />
            ))}
          </colgroup>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      className={h.column.columnDef.meta?.className}
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : undefined
                      }
                    >
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button
                          type="button"
                          className="board-sort"
                          onClick={h.column.getToggleSortingHandler()}
                          title="Sort"
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          <span
                            className={clsx(
                              'board-sort__arrow',
                              sorted && 'board-sort__arrow--on',
                            )}
                            aria-hidden="true"
                          >
                            {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '↕'}
                          </span>
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {padTop > 0 ? (
              <tr aria-hidden="true">
                <td
                  colSpan={colCount}
                  className="board-spacer"
                  style={{ height: padTop }}
                />
              </tr>
            ) : null}
            {virtualRows.map((vr) => {
              const row = rows[vr.index];
              if (!row) return null;
              const p = row.original;
              return (
                <tr
                  key={row.id}
                  className="board-row"
                  tabIndex={0}
                  onClick={(e) => onRowClick(e, p.asin)}
                  onKeyDown={(e) => onRowKeyDown(e, p.asin)}
                  aria-label={`Open history for ${p.name ?? p.asin}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cell.column.columnDef.meta?.className}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {padBottom > 0 ? (
              <tr aria-hidden="true">
                <td
                  colSpan={colCount}
                  className="board-spacer"
                  style={{ height: padBottom }}
                />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
