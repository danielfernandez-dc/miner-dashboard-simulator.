/** Exercises actual Chrome action and lifecycle callbacks, including native
 * closure and worker rehydration. Cache clears only on opening, never closing. */
import {beforeEach, expect, it, vi} from 'vitest';
const api = vi.hoisted(() => ({contexts: vi.fn(), opened: vi.fn(), closed: vi.fn(), behavior: vi.fn(), open: vi.fn(), close: vi.fn(), click: vi.fn(), removed: vi.fn(), query: vi.fn(), clear: vi.fn()}));
vi.mock('wxt/browser', () => ({browser: {
  runtime: {getContexts: api.contexts},
  sidePanel: {onOpened: {addListener: api.opened}, onClosed: {addListener: api.closed}, setPanelBehavior: api.behavior, open: api.open, close: api.close},
  action: {onClicked: {addListener: api.click}}, tabs: {onRemoved: {addListener: api.removed}, query: api.query},
}}));
vi.mock('../cache/clearPageCache', () => ({clearPageCache: api.clear}));
import {installPanelController} from './controller';
const tab = {id: 7, windowId: 3, url: 'https://www.youtube.com/'};
beforeEach(() => {vi.resetAllMocks(); for (const mock of [api.open, api.close, api.behavior]) mock.mockResolvedValue(undefined); api.contexts.mockResolvedValue([]); api.clear.mockResolvedValue({status:'cleared'}); api.query.mockResolvedValue([tab]);});
it('opens synchronously, awaits cache before reading, then closes and opens again', async () => {
  const prepare = installPanelController(); await Promise.resolve();
  const click = api.click.mock.calls[0]![0];
  click(tab); expect(api.open).toHaveBeenCalledWith({windowId: 3});
  expect(await prepare()).toEqual({status: 'cleared'});
  click(tab); expect(api.close).toHaveBeenCalledWith({windowId: 3}); expect(api.clear).toHaveBeenCalledTimes(1);
  api.closed.mock.calls[0]![0]({windowId:3});
  click(tab); expect(api.open).toHaveBeenCalledTimes(2); expect(api.clear).toHaveBeenCalledTimes(2);
});
it('recognizes a panel that survived worker suspension', async () => {
  api.contexts.mockResolvedValue([{windowId:3}]); installPanelController(); await Promise.resolve();
  api.click.mock.calls[0]![0](tab); expect(api.close).toHaveBeenCalledOnce(); expect(api.clear).not.toHaveBeenCalled();
});
it('does not close a panel in a different browser window', async () => {
  installPanelController(); await Promise.resolve(); api.opened.mock.calls[0]![0]({windowId:8}); api.click.mock.calls[0]![0](tab);
  expect(api.open).toHaveBeenCalledWith({windowId:3}); expect(api.close).not.toHaveBeenCalled();
});
it('supports opening through Chrome’s own panel selector', async () => {
  const prepare = installPanelController(); expect(await prepare()).toMatchObject({status:'cleared'}); expect(api.clear).toHaveBeenCalledWith(tab.url);
});
