/** Tracks the visible Atlas panel per Chrome window, including native close
 * buttons and background-worker restarts. Opening stays synchronous with the
 * toolbar gesture; cache removal runs alongside it and is awaited by the UI. */
import { browser } from 'wxt/browser';
import { clearPageCache, type CacheResult } from '../cache/clearPageCache';

export function installPanelController() {
  const visible = new Set<number>();
  let changed = false;
  const cacheJobs = new Map<number, Promise<CacheResult>>();
  // Rehydrate from actual Chrome contexts rather than a stale boolean in storage.
  void browser.runtime.getContexts({contextTypes: ['SIDE_PANEL']}).then(contexts => {
    if (!changed) for (const context of contexts) visible.add(context.windowId);
  }).catch(console.error);
  browser.sidePanel.onOpened.addListener(info => {changed = true; visible.add(info.windowId);});
  browser.sidePanel.onClosed.addListener(info => {changed = true; visible.delete(info.windowId);});
  void browser.sidePanel.setPanelBehavior({openPanelOnActionClick: false}).catch(console.error);
  browser.action.onClicked.addListener(tab => {
    if (tab.id === undefined) return;
    if (visible.has(tab.windowId)) {
      void browser.sidePanel.close({windowId: tab.windowId}).catch(console.error);
      return;
    }
    changed = true;
    visible.add(tab.windowId);
    cacheJobs.set(tab.id, clearPageCache(tab.url));
    // Do not await cache removal: Chrome requires opening within this gesture.
    void browser.sidePanel.open({windowId: tab.windowId}).catch(error => {visible.delete(tab.windowId); console.error(error);});
  });
  browser.tabs.onRemoved.addListener(tabId => cacheJobs.delete(tabId));
  return async function prepareRead(): Promise<CacheResult> {
    const [tab] = await browser.tabs.query({active: true, currentWindow: true});
    if (tab?.id === undefined) return clearPageCache();
    let job = cacheJobs.get(tab.id);
    if (!job) {job = clearPageCache(tab.url); cacheJobs.set(tab.id, job);}
    return job;
  };
}
