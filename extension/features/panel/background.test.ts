/** Protects asynchronous panel messages on Chrome versions before 148: the
 * channel stays open via true and responds through Chrome's callback contract. */
import {expect, it, vi} from 'vitest';
const api = vi.hoisted(() => ({listen: vi.fn(), prepare: vi.fn().mockResolvedValue({status:'cleared'}), append: vi.fn().mockResolvedValue({schemaVersion:1,errors:[]})}));
vi.mock('wxt/browser', () => ({browser: {runtime: {id: 'atlas', onMessage: {addListener: api.listen}}}}));
vi.mock('wxt/utils/define-background', () => ({defineBackground: (run: () => void) => {run(); return {};}}));
vi.mock('./controller', () => ({installPanelController: () => api.prepare}));
vi.mock('../errors/archive', () => ({appendUnknownErrors: api.append, validateArchive: vi.fn()}));
import '../../entrypoints/background';
it('keeps cache and archive responses open until the callback completes', async () => {
  const respond = vi.fn(); const listener = api.listen.mock.calls[0]![0];
  expect(listener({type:'atlas:prepare-read'}, {id:'atlas'}, respond)).toBe(true);
  await Promise.resolve(); expect(respond).toHaveBeenCalledWith({status:'cleared'});
  expect(listener({type:'atlas:archive-errors',archive:{schemaVersion:1,errors:[]}}, {id:'atlas'}, respond)).toBe(true);
  await Promise.resolve(); expect(respond).toHaveBeenCalledWith({archive:{schemaVersion:1,errors:[]}});
  expect(listener({type:'atlas:prepare-read'}, {id:'another-extension'}, respond)).toBeUndefined();
});
