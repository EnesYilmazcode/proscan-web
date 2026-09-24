// Converters that check every document against the shared schema as it is
// read. A document that fails keeps its data but is marked, and the hooks
// leave it out of the view and count it, so a bad write shows up as a
// notice instead of a row of dashes.

import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  validateHistory,
  validatePage,
  validateProduct,
  validateRun,
  validateSource,
} from '../../../packages/schema/index.js';
import type { HistoryDoc, PageDoc, Product, Run, Source } from './types';

export interface SchemaProblem {
  path: string;
  problems: string[];
}

const marks = new WeakMap<object, SchemaProblem>();

/** The schema problems of a document read through a checked converter. */
export function problemOf(value: object): SchemaProblem | undefined {
  return marks.get(value);
}

function checked<T extends object>(
  validate: (doc: unknown) => string[],
  // Documents the dashboard alone wrote (a lead note on a product the
  // extension never saw, a nickname on a new source) carry no schema fields.
  extensionWrote: (data: DocumentData) => boolean = () => true,
): FirestoreDataConverter<T> {
  return {
    toFirestore: (data) => data as DocumentData,
    fromFirestore(snap: QueryDocumentSnapshot) {
      const data = snap.data();
      if (extensionWrote(data)) {
        const problems = validate(data);
        if (problems.length > 0) marks.set(data, { path: snap.ref.path, problems });
      }
      return data as T;
    },
  };
}

export const productConverter = checked<Product>(
  validateProduct,
  (d) => 'sv' in d || 'latest' in d,
);
export const runConverter = checked<Run>(validateRun);
export const pageConverter = checked<PageDoc>(validatePage);
export const sourceConverter = checked<Source>(validateSource, (d) => 'sv' in d || 'lastRunId' in d);
export const historyConverter = checked<HistoryDoc>(validateHistory, (d) => 'sv' in d);

/** Splits rows into the ones that passed and the problems of the rest. */
export function splitChecked<T extends object>(rows: T[]): { valid: T[]; invalid: SchemaProblem[] } {
  const valid: T[] = [];
  const invalid: SchemaProblem[] = [];
  for (const row of rows) {
    const problem = marks.get(row);
    if (problem) invalid.push(problem);
    else valid.push(row);
  }
  if (invalid.length > 0) {
    console.warn(`[proscan] ${invalid.length} documents failed the schema check`, invalid.slice(0, 5));
  }
  return { valid, invalid };
}
