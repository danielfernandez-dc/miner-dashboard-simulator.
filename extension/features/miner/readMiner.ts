/** Reads the selected simulator tab through temporary, user-triggered injection.
 * Its documented BroadcastChannel supplies the full retained buffer even when UI
 * filters hide entries. No reload, host-wide access, or miner commands are used. */
import { browser } from 'wxt/browser';
export interface MinerSnapshot { text: string; name: string; host: string; origin: string; complete: boolean; readAt: number; tabId: number }
export function supportsMiner(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.origin === 'https://miner-dashboard-simulator.vercel.app' || (['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol === 'http:')) && ['/', '/index.html'].includes(u.pathname);
  } catch { return false; }
}
// Chrome serializes this function, so it must not depend on module-scope values.
export async function readSimulatorPage(): Promise<{text: string; name: string; host: string; origin: string; complete: boolean}> {
  if (!document.querySelector('#scenario') || !document.querySelector('#log-output')) throw new Error('The simulator log could not be found.');
  const name = document.querySelector('.page-heading h1')?.firstChild?.textContent?.trim() || 'Miner simulator';
  const host = location.host;
  const rawLink = document.querySelector<HTMLAnchorElement>('#raw-log');
  const session = rawLink ? new URL(rawLink.href, location.href).searchParams.get('session') : null;
  if (!session || typeof BroadcastChannel === 'undefined') throw new Error('The complete simulator log is unavailable. Open the main simulator dashboard and try again.');
  const text = await new Promise<string>((resolve, reject) => {
    const channel = new BroadcastChannel(`miner-logs-${session}`);
    const timer = setTimeout(() => {channel.close(); reject(new Error('The simulator did not respond. Keep its dashboard open and try again.'));}, 3500);
    channel.onmessage = event => {
      if (typeof event.data?.text !== 'string' || event.data.text.length > 2_000_000) return;
      clearTimeout(timer); channel.close(); resolve(event.data.text);
    };
    channel.postMessage('request');
  });
  return {text, name, host, origin: location.origin, complete: true};
}
export async function readMiner(): Promise<MinerSnapshot> {
  const [tab] = await browser.tabs.query({active: true, currentWindow: true});
  if (tab?.id === undefined) throw new Error('No active browser tab was found. Open the simulator and click Atlas again.');
  if (!tab.url) throw new Error('Chrome has not granted page access. Click the Atlas extension button on the simulator tab, then read again.');
  if (!supportsMiner(tab.url)) throw new Error('Open the Miner Lab simulator dashboard, then click the Atlas extension button on that tab.');
  const results = await browser.scripting.executeScript({target: {tabId: tab.id}, world: 'MAIN', func: readSimulatorPage});
  const value = results[0]?.result;
  if (!value || typeof value.text !== 'string' || value.text.length > 2_000_000 || !value.complete || typeof value.name !== 'string' || typeof value.host !== 'string' || typeof value.origin !== 'string') throw new Error('The simulator returned an invalid log snapshot.');
  return {...value, readAt: Date.now(), tabId: tab.id};
}
