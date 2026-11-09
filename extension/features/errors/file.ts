/** Holds the user-selected errors.json handle in extension IndexedDB. Unknown
 * entries are first saved in Chrome storage, then merged into this authorized
 * file. Existing file records survive; denied access never discards the queue. */
import { mergeArchives, validateArchive, type ErrorArchive } from './archive';
interface WritableHandle extends FileSystemFileHandle {
  queryPermission(options: {mode: 'readwrite'}): Promise<PermissionState>;
  requestPermission(options: {mode: 'readwrite'}): Promise<PermissionState>;
}
interface FilePickerWindow extends Window {
  showOpenFilePicker(options: {multiple: boolean; types: {description: string; accept: Record<string, string[]>}[]}): Promise<WritableHandle[]>;
}
function handles(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('atlas-error-file', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('handles');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function getHandle(): Promise<WritableHandle | undefined> {
  const db = await handles();
  try { return await new Promise((resolve, reject) => {
    const request = db.transaction('handles').objectStore('handles').get('errors');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
async function rememberHandle(handle: WritableHandle): Promise<void> {
  const db = await handles();
  try { await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('handles', 'readwrite'); transaction.objectStore('handles').put(handle, 'errors');
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
  }); } finally {db.close();}
}
async function mergeIntoFile(handle: WritableHandle, archive: ErrorArchive): Promise<void> {
  return navigator.locks.request('atlas-errors-file', () => writeMergedFile(handle, archive));
}
export async function writeMergedFile(handle: WritableHandle, archive: ErrorArchive): Promise<void> {
  const file = await handle.getFile();
  if (file.size > 10_000_000) throw new Error('errors.json is too large to merge safely. Unknown errors remain saved in Chrome.');
  const existing: unknown = JSON.parse(await file.text()); validateArchive(existing);
  const writable = await handle.createWritable();
  try {await writable.write(JSON.stringify(mergeArchives(existing, archive), null, 2) + '\n'); await writable.close();}
  catch (error) {await writable.abort().catch(() => undefined); throw error;}
}
export async function connectErrorFile(archive: ErrorArchive): Promise<void> {
  if (!('showOpenFilePicker' in window)) throw new Error('This Chrome version cannot connect a local file. Errors remain saved in Chrome.');
  // Must be the first asynchronous operation in this user-click handler.
  const [handle] = await (window as FilePickerWindow).showOpenFilePicker({multiple: false, types: [{description: 'Atlas errors.json', accept: {'application/json': ['.json']}}]});
  if (!handle || handle.name !== 'errors.json') throw new Error('Choose the errors.json file created for Atlas.');
  if (await handle.requestPermission({mode: 'readwrite'}) !== 'granted') throw new Error('File access was not granted. Unknown errors remain saved in Chrome.');
  await mergeIntoFile(handle, archive); await rememberHandle(handle);
}
let syncs: Promise<unknown> = Promise.resolve();
export function syncErrorFile(archive: ErrorArchive): Promise<'synced' | 'not-connected'> {
  const operation = syncs.then(async () => {
    const handle = await getHandle();
    if (!handle || await handle.queryPermission({mode: 'readwrite'}) !== 'granted') return 'not-connected' as const;
    await mergeIntoFile(handle, archive); return 'synced' as const;
  });
  syncs = operation.catch(() => undefined); return operation;
}
