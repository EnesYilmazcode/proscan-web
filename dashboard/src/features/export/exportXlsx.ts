// XLSX export — writes the ALREADY-LOADED view rows to an FBA-lead-list
// workbook (zero extra Firestore reads — read-cost hygiene). The heavy
// `xlsx` (SheetJS) package is loaded via dynamic import() inside
// exportProductsXlsx so it stays out of the main chunk; the row-shaping
// logic below (buildRows / defaultFilename) is pure and testable.

import type { Product, WorkspaceSettings } from '../../lib/types';
import { toMillis } from '../../lib/format';

export interface ExportXlsxOptions {
  filename?: string;
  /** Used for derived columns (e.g. Max Buy recompute at export time). */
  settings?: WorkspaceSettings;
}

/** A single worksheet cell: string, number, or null (= blank cell). */
export type ExportCell = string | number | null;

export const SHEET_NAME = 'ProScan Leads';

interface ColumnSpec {
  header: string;
  /** Excel column width in characters (worksheet `!cols`). */
  wch: number;
  /** Money column — value is dollars (cents / 100), formatted 0.00. */
  money?: boolean;
}

/** Column order is the export contract — do not reorder. */
const COLUMNS: readonly ColumnSpec[] = [
  { header: 'ASIN', wch: 12 },
  { header: 'Product Name', wch: 48 },
  { header: 'URL', wch: 42 },
  { header: 'Current Price', wch: 13, money: true },
  { header: 'List Price', wch: 10, money: true },
  { header: 'Δ Price', wch: 9, money: true },
  { header: 'Δ %', wch: 8 },
  { header: 'Rating', wch: 7 },
  { header: 'Δ Rating', wch: 9 },
  { header: 'Reviews', wch: 9 },
  { header: 'Δ Reviews', wch: 10 },
  { header: 'Rank', wch: 7 },
  { header: 'Sellers', wch: 8 },
  { header: 'Min Offer', wch: 10, money: true },
  { header: 'Median Offer', wch: 13, money: true },
  { header: 'Max Offer', wch: 10, money: true },
  { header: 'CV %', wch: 7 },
  { header: 'FBA Sellers', wch: 11 },
  { header: 'Amazon on Listing (Y/N)', wch: 22 },
  { header: 'Buy Box Price', wch: 13, money: true },
  { header: 'Max Buy Price', wch: 13, money: true },
  { header: 'Opportunity Score', wch: 17 },
  { header: 'Lead Stage', wch: 11 },
  { header: 'Notes', wch: 32 },
  { header: 'Tags', wch: 20 },
  { header: 'Source IDs', wch: 24 },
  { header: 'First Seen', wch: 11 },
  { header: 'Last Scanned', wch: 12 },
];

export const EXPORT_HEADERS: readonly string[] = COLUMNS.map((c) => c.header);

/** 0-based indexes of the dollar-valued columns (for number formatting). */
const MONEY_COLUMN_INDEXES: readonly number[] = COLUMNS.flatMap((c, i) =>
  c.money ? [i] : [],
);

/* ── pure cell helpers ─────────────────────────────────────────────── */

/** Integer cents -> dollars number at 2dp; absent -> blank. */
function centsToDollars(cents: number | null | undefined): number | null {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return null;
  return Math.round(cents) / 100;
}

/** Pass a finite number through; absent/NaN -> blank. */
function num(n: number | null | undefined): number | null {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  return n;
}

/** Round to 2dp (Δ %, CV %, ratings, scores) to avoid float noise. */
function round2(n: number | null | undefined): number | null {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function yn(b: boolean | null | undefined): string | null {
  if (b === null || b === undefined) return null;
  return b ? 'Y' : 'N';
}

function joinList(items: string[] | null | undefined): string | null {
  if (!items || items.length === 0) return null;
  return items.join(', ');
}

function text(s: string | null | undefined): string | null {
  if (s === null || s === undefined || s === '') return null;
  return s;
}

/** Timestamp-like -> ISO 'YYYY-MM-DD' (UTC, matches dayKey convention). */
function isoDate(at: Parameters<typeof toMillis>[0]): string | null {
  const ms = toMillis(at);
  if (ms === null) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

/* ── pure row shaping (testable, no xlsx dependency) ───────────────── */

/** One worksheet data row per product, in EXPORT_HEADERS column order.
 *  Money as dollars (cents / 100); absent values -> null (blank cell). */
export function buildRows(rows: Product[]): ExportCell[][] {
  return rows.map((p) => {
    const { latest, delta, spread, scores, lead } = p;
    return [
      p.asin,
      text(p.name),
      text(p.url),
      centsToDollars(latest?.p),
      centsToDollars(latest?.lp),
      centsToDollars(delta?.p),
      round2(delta?.pPct),
      round2(latest?.r),
      round2(delta?.r),
      num(latest?.v),
      num(delta?.v),
      num(latest?.rk),
      num(spread?.sc),
      centsToDollars(spread?.mn),
      centsToDollars(spread?.md),
      centsToDollars(spread?.mx),
      spread?.cv === undefined ? null : round2(spread.cv * 100),
      num(spread?.fba),
      yn(spread?.az),
      centsToDollars(spread?.bb?.p),
      centsToDollars(scores?.maxBuy),
      round2(scores?.opportunity),
      text(lead?.stage),
      text(lead?.notes),
      joinList(p.tags),
      joinList(p.sourceIds),
      isoDate(p.firstSeenAt),
      isoDate(latest?.at),
    ];
  });
}

/** proscan-leads-<date>.xlsx where <date> = max latest.at across rows
 *  (YYYY-MM-DD, derived from the data — not the wall clock). */
export function defaultFilename(rows: Product[]): string {
  let maxMs: number | null = null;
  for (const p of rows) {
    const ms = toMillis(p.latest?.at);
    if (ms !== null && (maxMs === null || ms > maxMs)) maxMs = ms;
  }
  const date = maxMs === null ? 'export' : new Date(maxMs).toISOString().slice(0, 10);
  return `proscan-leads-${date}.xlsx`;
}

/* ── workbook write ────────────────────────────────────────────────── */

/** Build the "ProScan Leads" workbook and trigger a browser download.
 *  Async: `xlsx` is dynamically imported here so it loads on demand and
 *  never lands in the main chunk. Fire from a click handler. */
export async function exportProductsXlsx(
  rows: Product[],
  opts?: ExportXlsxOptions,
): Promise<void> {
  const XLSX = await import('xlsx');

  const data = buildRows(rows);
  const ws = XLSX.utils.aoa_to_sheet([[...EXPORT_HEADERS], ...data]);

  ws['!cols'] = COLUMNS.map((c) => ({ wch: c.wch }));

  // Freeze the header row. NOTE: SheetJS Community Edition 0.18.x parses
  // but does not serialize panes (Pro feature) — declared here so the
  // intent survives a lib upgrade; harmless no-op today.
  ws['!freeze'] = {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: 'A2',
    activePane: 'bottomLeft',
    state: 'frozen',
  };

  // 2dp display format on the dollar columns (rows are 1-based past header).
  for (let r = 0; r < data.length; r++) {
    for (const c of MONEY_COLUMN_INDEXES) {
      const cell = ws[XLSX.utils.encode_cell({ r: r + 1, c })];
      if (cell && cell.t === 'n') cell.z = '0.00';
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  XLSX.writeFile(wb, opts?.filename ?? defaultFilename(rows), {
    compression: true,
  });
}
