/** Verifies that a read uses the simulator's complete buffer rather than filtered
 * DOM rows, and refuses unrelated sites. The page bridge is isolated with mocks. */
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('wxt/browser', () => ({browser: {}}));
import { supportsMiner, readSimulatorPage } from './readMiner';
afterEach(() => vi.unstubAllGlobals());
it('limits reads to supported dashboard origins and paths', () => {
  expect(supportsMiner('https://miner-dashboard-simulator.vercel.app/')).toBe(true);
  expect(supportsMiner('http://localhost:8080/')).toBe(true);
  for (const url of ['https://example.com/', 'https://miner-dashboard-simulator.vercel.app.evil.test/', 'https://miner-dashboard-simulator.vercel.app/raw-log.html', 'chrome://extensions']) expect(supportsMiner(url)).toBe(false);
});
it('requests full logs and closes its temporary channel', async () => {
  const close = vi.fn();
  class Channel {
    onmessage?: (event: {data: {text: string}}) => void;
    close = close;
    postMessage(message: string) { expect(message).toBe('request'); queueMicrotask(() => this.onmessage?.({data: {text: 'complete unfiltered log'}})); }
  }
  vi.stubGlobal('BroadcastChannel', Channel);
  vi.stubGlobal('location', {host: 'localhost:8080', origin: 'http://localhost:8080', href: 'http://localhost:8080/'});
  vi.stubGlobal('document', {querySelector: (s: string) => s === '#raw-log' ? {href: 'http://localhost:8080/raw-log.html?session=test'} : s === '.page-heading h1' ? {firstChild: {textContent: 'Antminer S19 Pro '}} : {}});
  expect(await readSimulatorPage()).toMatchObject({text: 'complete unfiltered log', complete: true, name: 'Antminer S19 Pro'});
  expect(close).toHaveBeenCalledOnce();
});
