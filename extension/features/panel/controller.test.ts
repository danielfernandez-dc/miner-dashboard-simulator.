/** Checks toolbar toggling, native closure, and suspended-worker rehydration.
 * Opening must happen synchronously; only new openings should clear cache. */
import {beforeEach, expect, it, vi} from 'vitest';
const api = vi.hoisted(() => ({opened:vi.fn(), closed:vi.fn(), behavior:vi.fn(), click:vi.fn(), query:vi.fn(), clear:vi.fn(), open:vi.fn(), close:vi.fn(), get:vi.fn(), set:vi.fn()}));
vi.mock('wxt/browser', () => ({browser: {
  storage: {session: {get:api.get,set:api.set}},
  sidePanel: {onOpened:{addListener:api.opened}, onClosed:{addListener:api.closed}, setPanelBehavior:api.behavior, open:api.open, close:api.close},
  action:{onClicked:{addListener:api.click}}, tabs:{query:api.query},
}}));
vi.mock('../cache/clearPageCache', () => ({clearPageCache:api.clear}));
import {installPanelController} from './controller';
const tab = {id:7,windowId:3,url:'https://www.youtube.com/'};
beforeEach(() => {vi.resetAllMocks(); for (const mock of [api.behavior,api.open,api.close,api.set]) mock.mockResolvedValue(undefined); api.get.mockResolvedValue({}); api.clear.mockResolvedValue({status:'cleared'}); api.query.mockResolvedValue([tab]);});
it('opens, closes, and reopens, without clearing on close or ordinary reread', async () => {
  const prepare = installPanelController(); await Promise.resolve(); const click=api.click.mock.calls[0]![0];
  click(tab); expect(api.open).toHaveBeenCalledOnce(); await vi.waitFor(() => expect(api.clear).toHaveBeenCalledTimes(1));
  await prepare(); expect(api.clear).toHaveBeenCalledTimes(1);
  click(tab); expect(api.close).toHaveBeenCalledWith({windowId:3}); expect(api.clear).toHaveBeenCalledTimes(1);
  api.closed.mock.calls[0]![0]({windowId:3}); click(tab); await vi.waitFor(() => expect(api.clear).toHaveBeenCalledTimes(2));
});
it('restores open state after worker suspension and closes on the next click', async () => {
  api.get.mockResolvedValue({'atlasPanelOpen:3':true}); installPanelController(); await Promise.resolve(); api.click.mock.calls[0]![0](tab);
  expect(api.close).toHaveBeenCalledOnce(); expect(api.open).not.toHaveBeenCalled();
});
it('retains the opening gesture even if storage hydration is still pending', async () => {
  let resolve!: (v: Record<string,boolean>) => void; api.get.mockReturnValue(new Promise(r => {resolve=r;})); installPanelController();
  api.click.mock.calls[0]![0](tab); expect(api.open).toHaveBeenCalledOnce(); resolve({'atlasPanelOpen:3':true});
  await vi.waitFor(() => expect(api.close).toHaveBeenCalledOnce()); expect(api.clear).not.toHaveBeenCalled();
});
it('respects native closure and separate browser windows', async () => {
  installPanelController(); await Promise.resolve(); api.opened.mock.calls[0]![0]({windowId:3}); api.closed.mock.calls[0]![0]({windowId:3});
  api.opened.mock.calls[0]![0]({windowId:8}); api.click.mock.calls[0]![0](tab); expect(api.open).toHaveBeenCalledWith({windowId:3}); expect(api.close).not.toHaveBeenCalled();
});
