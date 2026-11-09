/** Protects deletion scope and truthful completion reporting across first-party
 * storage, frame sessions, provider cookies, and top-level cookie partitions. */
import {beforeEach, expect, it, vi} from 'vitest';
const api = vi.hoisted(() => ({remove:vi.fn(), contains:vi.fn(), execute:vi.fn(), key:vi.fn(), stores:vi.fn(), cookies:vi.fn(), removeCookie:vi.fn()}));
vi.mock('wxt/browser', () => ({browser: {
  browsingData:{remove:api.remove}, permissions:{contains:api.contains}, scripting:{executeScript:api.execute},
  cookies:{getPartitionKey:api.key,getAllCookieStores:api.stores,getAll:api.cookies,remove:api.removeCookie},
}}));
import {clearSiteData, clearFrameSession} from './clearSiteData';
const page = {origin:'https://www.youtube.com',frameOrigins:[],resourceOrigins:[],sessionCleared:true,blockedFrames:0};
beforeEach(() => {
  vi.resetAllMocks(); api.remove.mockResolvedValue(undefined); api.contains.mockResolvedValue(true);
  api.execute.mockResolvedValue([{frameId:0,result:page}]); api.key.mockResolvedValue({partitionKey:{topLevelSite:'https://youtube.com'}});
  api.stores.mockResolvedValue([{id:'0',tabIds:[7]}]); api.cookies.mockResolvedValue([]); api.removeCookie.mockResolvedValue({});
});
it('clears all requested persistent categories with a nonempty current-origin filter', async () => {
  expect((await clearSiteData('https://www.youtube.com/watch?v=example',7)).status).toBe('cleared');
  expect(api.remove).toHaveBeenCalledExactlyOnceWith({since:0,origins:['https://www.youtube.com'],originTypes:{unprotectedWeb:true,protectedWeb:true}}, {
    cache:true,cacheStorage:true,indexedDB:true,localStorage:true,cookies:true,serviceWorkers:true,fileSystems:true,webSQL:true,
  });
  expect(api.execute).toHaveBeenCalledWith({target:{tabId:7,allFrames:true},world:'ISOLATED',func:clearFrameSession,args:[false]});
});
it('clears embedded frames and provider cookies without touching unrelated origins', async () => {
  api.execute.mockResolvedValue([{frameId:0,result:{...page,frameOrigins:['https://player.example/','chrome-extension://atlas/'],resourceOrigins:['https://cdn.example/script.js','data:text/plain,ignored']}}]);
  await clearSiteData('https://www.youtube.com/',7);
  expect(api.remove.mock.calls[0]![0].origins).toEqual(['https://www.youtube.com','https://player.example']);
  expect(api.remove.mock.calls[1]).toEqual([{since:0,origins:['https://cdn.example']},{cookies:true}]);
});
it('removes third-party cookies only from this top-level site’s partition and cookie store', async () => {
  const cookie = {name:'tracking',domain:'.embed.example',path:'/',secure:true,storeId:'0',partitionKey:{topLevelSite:'https://youtube.com',hasCrossSiteAncestor:true}};
  api.cookies.mockResolvedValue([cookie,{...cookie,partitionKey:{topLevelSite:'https://other.example'}},{...cookie,partitionKey:undefined}]);
  await clearSiteData('https://www.youtube.com/',7);
  expect(api.cookies).toHaveBeenCalledWith({storeId:'0',partitionKey:{topLevelSite:'https://youtube.com'}});
  expect(api.removeCookie).toHaveBeenCalledExactlyOnceWith({url:'https://embed.example/',name:'tracking',storeId:'0',partitionKey:cookie.partitionKey});
});
it('reports limited access without claiming embedded storage and cookies were cleared', async () => {
  api.contains.mockResolvedValue(false);
  expect(await clearSiteData('https://www.youtube.com/',7)).toMatchObject({status:'partial',needsAccess:true});
  expect(api.execute.mock.calls[0]![0].target.allFrames).toBe(false); expect(api.cookies).not.toHaveBeenCalled();
});
it('continues persistent deletion when frame clearing fails, but reports the limitation', async () => {
  api.execute.mockRejectedValue(new Error('Frame access denied'));
  expect((await clearSiteData('https://www.youtube.com/',7)).status).toBe('partial'); expect(api.remove).toHaveBeenCalled();
});
it('reports partitioned-cookie deletion failures', async () => {
  api.key.mockRejectedValue(new Error('No key'));
  expect((await clearSiteData('https://www.youtube.com/',7)).status).toBe('failed');
});
it('reports persistent-data deletion failure rather than a successful wipe', async () => {
  api.remove.mockRejectedValue(new Error('Denied'));
  expect((await clearSiteData('http://localhost:8080',7)).status).toBe('failed');
});
it('never clears the browser globally or touches extension storage for invalid URLs', async () => {
  for (const url of [undefined,'','not-a-url','chrome://settings','file:///test','chrome-extension://atlas/sidepanel.html']) expect((await clearSiteData(url,7)).status).toBe('skipped');
  expect(api.remove).not.toHaveBeenCalled(); expect(api.execute).not.toHaveBeenCalled(); expect(api.cookies).not.toHaveBeenCalled();
});
it('does not call a missing tab a complete session-storage clear', async () => {
  expect((await clearSiteData('http://localhost:8080')).status).toBe('partial'); expect(api.execute).not.toHaveBeenCalled();
});
it('clears actual frame session storage and flags inaccessible child sessions', () => {
  const clear = vi.fn();
  const child = {get document(){throw new Error('Cross-origin');}};
  const win = {sessionStorage:{clear}, performance:{getEntriesByType:()=>[{name:'https://cdn.example/video.js'}]}, document:{querySelectorAll:()=>[{src:'https://embed.example/'}]}, location:{href:'https://www.youtube.com/'}, frames:[child]};
  vi.stubGlobal('window',win); vi.stubGlobal('location',{origin:'https://www.youtube.com'});
  try {expect(clearFrameSession(true)).toMatchObject({sessionCleared:true,blockedFrames:1,frameOrigins:['https://embed.example'],resourceOrigins:['https://cdn.example']}); expect(clear).toHaveBeenCalledOnce();}
  finally {vi.unstubAllGlobals();}
});
