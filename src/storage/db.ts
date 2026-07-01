import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Baseline, ObservationRecord } from '@/types';

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

/** Test-only: wipes all stores. */
export async function _clearAll(): Promise<void> {
  const db = await openDatabase();
  await Promise.all([db.clear('observations'), db.clear('baselines')]);
}
