import { addObservation } from '@/storage';
import type { ObservationRecord } from '@/types';

export interface SubmitResult {
  id: number;
  record: ObservationRecord;
}

/** Persists an already schema-validated ObservationRecord, from either the typed or LLM-assisted capture path. */
export async function submitObservation(record: ObservationRecord): Promise<SubmitResult> {
  const id = await addObservation(record);
  return { id, record };
}
