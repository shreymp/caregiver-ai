import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { updateBaseline } from '@/baseline';
import { validateObservation, type Baseline, type ObservationRecord } from '@/types';

const DB_NAME = 'perception-assist';
const DB_VERSION = 1;
const CURRENT_BASELINE_KEY = 'current';

interface PerceptionAssistDB extends DBSchema {
  observations: {
    key: number;
    value: ObservationRecord;
    indexes: { 'by-timestamp': string };
  };
  baselines: {
    key: string;
    value: Baseline;
  };
}

export type Db = IDBPDatabase<PerceptionAssistDB>;

let dbPromise: Promise<Db> | undefined;

/** Opens (and memoizes) the single app database connection. Client-side only. */
export function openDatabase(): Promise<Db> {
  dbPromise ??= openDB<PerceptionAssistDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const observations = db.createObjectStore('observations', { autoIncrement: true });
      observations.createIndex('by-timestamp', 'timestamp');
      db.createObjectStore('baselines');
    },
  });
  return dbPromise;
}

/** Test/reset hook: drops the memoized connection so the next call reopens fresh. */
export function _resetDatabaseHandle(): void {
  dbPromise = undefined;
}

export async function addObservation(record: ObservationRecord): Promise<number> {
  const db = await openDatabase();
  return db.add('observations', record);
}

export async function deleteObservation(id: number): Promise<void> {
  const db = await openDatabase();
  await db.delete('observations', id);
}

/** All observations, ascending by timestamp (ISO 8601 strings sort lexicographically). */
export async function getAllObservations(): Promise<ObservationRecord[]> {
  const db = await openDatabase();
  return db.getAllFromIndex('observations', 'by-timestamp');
}

export async function getBaseline(): Promise<Baseline> {
  const db = await openDatabase();
  const stored = await db.get('baselines', CURRENT_BASELINE_KEY);
  return stored ?? {};
}

export async function setBaseline(baseline: Baseline): Promise<void> {
  const db = await openDatabase();
  await db.put('baselines', baseline, CURRENT_BASELINE_KEY);
}

export interface ExportPayload {
  exportedAt: string;
  observations: ObservationRecord[];
  baseline: Baseline;
}

/** Full local data export (CLAUDE.md §2.7: client-side only, must be exportable). */
export async function exportAll(): Promise<ExportPayload> {
  const [observations, baseline] = await Promise.all([getAllObservations(), getBaseline()]);
  return { exportedAt: new Date().toISOString(), observations, baseline };
}

export async function exportAllAsJson(): Promise<string> {
  const payload = await exportAll();
  return JSON.stringify(payload, null, 2);
}

export interface ImportResult {
  importedObservations: number;
  /** Rows that didn't pass schema validation (e.g. a hand-edited or corrupted export file) — never trusted, always skipped rather than silently accepted. */
  rejectedObservations: number;
}

/**
 * Restores observations from a previously exported payload (CLAUDE.md M12:
 * "iOS storage re-hydration... restore from export" — iOS Safari can evict
 * IndexedDB under storage pressure). Replaces the current store contents
 * entirely, since a restore is meant to recover a prior authoritative state.
 * Every observation is re-validated (guardrail #3's "never trust unvalidated
 * data downstream" applies to a user-supplied file too, e.g. hand-edited or
 * corrupted JSON) — invalid rows are skipped, not silently accepted. The
 * baseline is recomputed from the restored observations rather than trusting
 * the export's serialized baseline blob, since it's fully derivable and
 * recomputing guarantees internal consistency.
 */
export async function importAll(payload: unknown): Promise<ImportResult> {
  const rawObservations =
    typeof payload === 'object' && payload !== null && Array.isArray((payload as { observations?: unknown }).observations)
      ? (payload as { observations: unknown[] }).observations
      : [];

  const validRecords: ObservationRecord[] = [];
  let rejectedObservations = 0;
  for (const raw of rawObservations) {
    const validation = validateObservation(raw);
    if (validation.valid) {
      validRecords.push(validation.record);
    } else {
      rejectedObservations += 1;
    }
  }

  const db = await openDatabase();
  await Promise.all([db.clear('observations'), db.clear('baselines')]);
  for (const record of validRecords) {
    await db.add('observations', record);
  }
  await db.put('baselines', updateBaseline(validRecords), CURRENT_BASELINE_KEY);

  return { importedObservations: validRecords.length, rejectedObservations };
}

/** Test-only: wipes all stores. */
export async function _clearAll(): Promise<void> {
  const db = await openDatabase();
  await Promise.all([db.clear('observations'), db.clear('baselines')]);
}
