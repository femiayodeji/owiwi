import type { DigestStatus } from '../db/queries';

export const STALE_GENERATING_MS = 2 * 60 * 1000;

export type GenerationDecision = 'use-cached' | 'start' | 'busy';

/**
 * Decides what to do for a (date, slot) given the existing digest row.
 * `force` is a user-confirmed regenerate.
 */
export function decideGeneration(
  existing: { status: DigestStatus; createdAt: number } | null,
  now: number,
  force: boolean,
): GenerationDecision {
  if (!existing) return 'start';
  if (existing.status === 'generating') {
    return now - existing.createdAt > STALE_GENERATING_MS ? 'start' : 'busy';
  }
  if (existing.status === 'ready' && !force) return 'use-cached';
  return 'start';
}
