/** Persists unmatched log entries separately from approved knowledge. Stable
 * hashes deduplicate overlapping snapshots; original lines retain their evidence.
 * The background worker serializes writes so multiple windows cannot lose data. */
import { browser } from 'wxt/browser';
import type { LogEntry } from '../diagnostics/analyze';
export const archiveKey = 'atlasUnknownErrors';
export interface UnknownError {
  id: string; origin: string; miner: string; firstSavedAt: string;
  timestamp: string; level: string; source: string; message: string; raw: string;
}
export interface ErrorArchive { schemaVersion: 1; errors: UnknownError[] }
export const emptyArchive = (): ErrorArchive => ({schemaVersion: 1, errors: []});
export function validateArchive(value: unknown): asserts value is ErrorArchive {
  const v = value as ErrorArchive;
  if (!v || v.schemaVersion !== 1 || !Array.isArray(v.errors) || v.errors.some(e => !e || ['id','origin','miner','firstSavedAt','timestamp','level','source','message','raw'].some(k => typeof e[k as keyof UnknownError] !== 'string'))) throw new Error('errors.json has an unsupported structure. Its contents have not been replaced.');
}
export function mergeArchives(...archives: ErrorArchive[]): ErrorArchive {
  const entries = new Map<string, UnknownError>();
  for (const archive of archives) {validateArchive(archive); for (const error of archive.errors) if (!entries.has(error.id)) entries.set(error.id, error);}
  return {schemaVersion: 1, errors: [...entries.values()]};
}
export async function makeUnknownErrors(entries: LogEntry[], origin: string, miner: string): Promise<ErrorArchive> {
  return {schemaVersion: 1, errors: await Promise.all(entries.map(async entry => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([origin, entry.raw])));
    const id = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    return {...entry, id, origin, miner, firstSavedAt: new Date().toISOString()};
  }))};
}
export async function getArchive(): Promise<ErrorArchive> {
  const value: unknown = (await browser.storage.local.get(archiveKey))[archiveKey];
  if (value === undefined) return emptyArchive();
  validateArchive(value); return value;
}
let writes: Promise<unknown> = Promise.resolve();
export function appendUnknownErrors(incoming: ErrorArchive): Promise<ErrorArchive> {
  const operation = writes.then(async () => {
    validateArchive(incoming);
    const archive = mergeArchives(await getArchive(), incoming);
    await browser.storage.local.set({[archiveKey]: archive});
    return archive;
  });
  writes = operation.catch(() => undefined);
  return operation;
}
