/** Guards the cache-only promise: every deletion is origin-scoped and never
 * includes cookies, website settings, or extension storage. */
import {beforeEach, expect, it, vi} from 'vitest';
const remove = vi.hoisted(() => vi.fn());
vi.mock('wxt/browser', () => ({browser: {browsingData: {remove}}}));
import {clearPageCache} from './clearPageCache';
beforeEach(() => {remove.mockReset(); remove.mockResolvedValue(undefined);});
it('clears only the current HTTP website caches, including YouTube', async () => {
  const result = await clearPageCache('https://www.youtube.com/watch?v=example');
  expect(remove).toHaveBeenCalledExactlyOnceWith({since: 0, origins: ['https://www.youtube.com']}, {cache: true, cacheStorage: true});
  expect(result.status).toBe('cleared');
});
it('never uses a broad deletion filter on invalid or protected URLs', async () => {
  for (const url of [undefined, '', 'not-a-url', 'chrome://settings', 'file:///test', 'chrome-extension://atlas/sidepanel.html']) expect((await clearPageCache(url)).status).toBe('skipped');
  expect(remove).not.toHaveBeenCalled();
});
it('reports a rejected deletion without claiming cache was cleared', async () => {
  remove.mockRejectedValue(new Error('Denied'));
  expect((await clearPageCache('http://localhost:8080')).status).toBe('failed');
});
