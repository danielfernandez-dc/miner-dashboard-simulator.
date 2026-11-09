/** Clears the selected website's persistent data and this tab's session storage.
 * Optional website access enables embedded frames and partitioned-cookie cleanup.
 * Provider origins come only from the clicked page, never the browsing history;
 * Atlas's own rules, inbox, and authorized file handle are outside this scope. */
import { browser } from 'wxt/browser';
export const fullSiteAccess = ['http://*/*', 'https://*/*'];
export interface ClearingResult {
  status: 'cleared' | 'partial' | 'skipped' | 'failed'; origin?: string;
  completedAt: number; message: string; needsAccess?: boolean;
}
interface PageStorage {
  origin: string; frameOrigins: string[]; resourceOrigins: string[];
  sessionCleared: boolean; blockedFrames: number;
}
export function webOrigin(url?: string): string | undefined {
  try {const parsed = new URL(url ?? ''); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : undefined;} catch {return undefined;}
}
// Chrome serializes this function. Keep it self-contained and use the isolated
// world so page scripts cannot replace the browser functions used for clearing.
export function clearFrameSession(includeSameOriginChildren: boolean): PageStorage {
  const frames = new Set<string>(); const resources = new Set<string>();
  let sessionCleared = true, blockedFrames = 0;
  const addOrigin = (set: Set<string>, value: string, base: string) => {
    try {const u = new URL(value, base); if (['http:', 'https:'].includes(u.protocol)) set.add(u.origin);} catch { /* Ignore non-website resources. */ }
  };
  const visit = (win: Window) => {
    try {
      try {win.sessionStorage.clear();} catch {sessionCleared = false;}
      for (const resource of win.performance.getEntriesByType('resource')) addOrigin(resources, resource.name, win.location.href);
      for (const node of win.document.querySelectorAll<HTMLIFrameElement>('iframe, frame')) {
        if (node.src) addOrigin(frames, node.src, win.location.href);
      }
      if (includeSameOriginChildren) for (let i = 0; i < win.frames.length; i++) {
        try {void win.frames[i]!.document; visit(win.frames[i]!);} catch {blockedFrames++;}
      }
    } catch {blockedFrames++; sessionCleared = false;}
  };
  visit(window);
  return {origin: location.origin, frameOrigins: [...frames], resourceOrigins: [...resources], sessionCleared, blockedFrames};
}
export async function clearSiteData(url?: string, tabId?: number): Promise<ClearingResult> {
  const origin = webOrigin(url);
  if (!origin) return {status:'skipped', completedAt:Date.now(), message:'Site-data clearing is available on HTTP and HTTPS websites.'};
  const limitations: string[] = [];
  const siteOrigins = new Set([origin]); const cookieOrigins = new Set([origin]);
  let fullAccess = false;
  try {fullAccess = await browser.permissions.contains({origins: fullSiteAccess});} catch { /* Continue with the toolbar's temporary grant. */ }
  if (!fullAccess) limitations.push('Enable complete clearing for embedded pages and third-party partitioned cookies.');
  if (tabId !== undefined) {
    try {
      const frames = await browser.scripting.executeScript({target:{tabId, allFrames: fullAccess}, world:'ISOLATED', func:clearFrameSession, args:[!fullAccess]});
      if (!frames.length || !frames.some(frame => frame.frameId === 0)) throw new Error('Missing main frame');
      for (const frame of frames) {
        const data = frame.result;
        if (!data || !Array.isArray(data.frameOrigins) || !Array.isArray(data.resourceOrigins)) throw new Error('Invalid page-storage response');
        for (const value of [data.origin, ...data.frameOrigins]) {const o = webOrigin(value); if (o) {siteOrigins.add(o); cookieOrigins.add(o);}}
        for (const value of data.resourceOrigins) {const o = webOrigin(value); if (o) cookieOrigins.add(o);}
        if (!data.sessionCleared || data.blockedFrames) limitations.push('Some frame session storage could not be cleared.');
      }
    } catch {limitations.push('Page session storage and embedded-provider discovery could not be completed.');}
  } else limitations.push('No page was available to clear session storage.');
  const failures: string[] = [];
  try {
    // Never omit origins: doing so would clear data for the whole browser.
    await browser.browsingData.remove({since:0, origins:[origin, ...[...siteOrigins].filter(value => value !== origin)], originTypes:{unprotectedWeb:true, protectedWeb:true}}, {
      cache:true, cacheStorage:true, indexedDB:true, localStorage:true,
      cookies:true, serviceWorkers:true, fileSystems:true, webSQL:true,
    });
  } catch {failures.push('Chrome could not finish clearing persistent website data.');}
  const providers = [...cookieOrigins].filter(value => !siteOrigins.has(value));
  if (providers.length) {
    try {await browser.browsingData.remove({since:0, origins:[providers[0]!, ...providers.slice(1)]}, {cookies:true});}
    catch {failures.push('Some embedded-provider cookies could not be removed.');}
  }
  if (fullAccess && tabId !== undefined) {
    try {
      const {partitionKey} = await browser.cookies.getPartitionKey({tabId, frameId:0});
      if (!partitionKey.topLevelSite) throw new Error('No cookie partition');
      const stores = await browser.cookies.getAllCookieStores();
      const store = stores.find(item => item.tabIds.includes(tabId));
      if (!store) throw new Error('No cookie store for this tab');
      const cookies = await browser.cookies.getAll({storeId:store.id, partitionKey:{topLevelSite:partitionKey.topLevelSite}});
      const removed = await Promise.allSettled(cookies.filter(cookie => cookie.partitionKey?.topLevelSite === partitionKey.topLevelSite).map(cookie => {
        const cookieUrl = `${cookie.secure ? 'https' : 'http'}://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
        return browser.cookies.remove({url:cookieUrl, name:cookie.name, storeId:cookie.storeId, partitionKey:cookie.partitionKey});
      }));
      if (removed.some(result => result.status === 'rejected')) throw new Error('Cookie removal failed');
    } catch {failures.push('Some partitioned third-party cookies could not be removed.');}
  }
  const notes = [...new Set([...limitations, ...failures])];
  return {
    status:failures.length ? 'failed' : notes.length ? 'partial' : 'cleared', origin, completedAt:Date.now(), needsAccess:!fullAccess,
    message: notes.length ? `Clearing ${new URL(origin).host}: ${notes.join(' ')}`
      : `Site data cleared for ${new URL(origin).host} and its detected embedded providers, including cookies and service workers.`,
  };
}
