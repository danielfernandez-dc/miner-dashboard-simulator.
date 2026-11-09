/** Toggles Atlas from an explicit action handler so Chrome grants activeTab.
 * Per-window visibility survives worker suspension in session storage and is
 * updated by native panel events. Opening stays synchronous with Chrome's gesture. */
import { browser } from 'wxt/browser';
import { clearPageCache, type CacheResult } from '../cache/clearPageCache';
const prefix = 'atlasPanelOpen:';
export function installPanelController() {
  const visibility = new Map<number, boolean>();
  const jobs = new Map<number, Promise<CacheResult>>();
  let hydrated = false;
  const initial = browser.storage.session.get(null).then(values => {
    for (const [key, value] of Object.entries(values)) if (key.startsWith(prefix)) {
      const windowId = Number(key.slice(prefix.length));
      if (!visibility.has(windowId)) visibility.set(windowId, value === true);
    }
    hydrated = true; return values;
  });
  const remember = (windowId: number, open: boolean) => {
    visibility.set(windowId, open);
    void browser.storage.session.set({[`${prefix}${windowId}`]: open}).catch(console.error);
  };
  const startCache = (windowId: number, url?: string) => {
    let job = jobs.get(windowId);
    if (!job) {job = clearPageCache(url); jobs.set(windowId, job);}
    return job;
  };
  const close = (windowId: number) => {
    remember(windowId, false);
    void browser.sidePanel.close({windowId}).catch(error => {remember(windowId, true); console.error(error);});
  };
  void browser.sidePanel.setPanelBehavior({openPanelOnActionClick: false}).catch(console.error);
  browser.sidePanel.onOpened.addListener(info => remember(info.windowId, true));
  browser.sidePanel.onClosed.addListener(info => {remember(info.windowId, false); jobs.delete(info.windowId);});
  browser.action.onClicked.addListener(tab => {
    if (tab.id === undefined) return;
    if (hydrated && visibility.get(tab.windowId)) {close(tab.windowId); return;}
    const wasOpen = hydrated ? Promise.resolve(false) : initial.then(values => values[`${prefix}${tab.windowId}`] === true);
    jobs.delete(tab.windowId);
    // This is synchronous even when the worker has just started. Reopening an
    // existing panel is a no-op; if its saved state was open, close it afterward.
    const opening = browser.sidePanel.open({windowId: tab.windowId});
    void opening.catch(console.error);
    void wasOpen.then(async previouslyOpen => {
      await opening;
      if (previouslyOpen) close(tab.windowId);
      else {remember(tab.windowId, true); void startCache(tab.windowId, tab.url);}
    }).catch(error => {remember(tab.windowId, false); console.error(error);});
  });
  return async function prepareRead(): Promise<CacheResult> {
    const [tab] = await browser.tabs.query({active:true, currentWindow:true});
    return tab ? startCache(tab.windowId, tab.url) : clearPageCache();
  };
}
