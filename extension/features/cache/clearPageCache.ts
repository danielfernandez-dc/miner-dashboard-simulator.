/** Clears only HTTP/resource cache and Cache Storage for the clicked website.
 * Cookies, login data, localStorage, IndexedDB, and extension knowledge survive.
 * It never reloads the page, so an in-memory miner log remains available. */
import { browser } from 'wxt/browser';
export interface CacheResult { status: 'cleared' | 'skipped' | 'failed'; origin?: string; completedAt: number; message: string }
export async function clearPageCache(url?: string): Promise<CacheResult> {
  let origin: string;
  try {
    const parsed = new URL(url ?? '');
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    origin = parsed.origin;
  } catch { return {status: 'skipped', completedAt: Date.now(), message: 'Cache clearing is available on HTTP and HTTPS websites.'}; }
  try {
    // Origins must never be omitted: an empty filter could clear every website.
    await browser.browsingData.remove({since: 0, origins: [origin]}, {cache: true, cacheStorage: true});
    return {status: 'cleared', origin, completedAt: Date.now(), message: `Page cache cleared for ${new URL(origin).host}. Logins and saved site data kept.`};
  } catch {
    return {status: 'failed', origin, completedAt: Date.now(), message: 'Chrome could not clear this website’s page cache. Close Atlas and open it again to retry.'};
  }
}
