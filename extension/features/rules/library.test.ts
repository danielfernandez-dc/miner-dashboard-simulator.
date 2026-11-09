/** Checks initialization and repair of the local rules cache. Chrome storage is
 * mocked here; no tests read or change a technician's real extension settings. */
import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({get: vi.fn(), set: vi.fn(), getURL: vi.fn((p: string) => p)}));
vi.mock('wxt/browser', () => ({browser: {runtime: {getURL: api.getURL}, storage: {local: {get: api.get, set: api.set}}}}));
import { loadLibrary, validateLibrary } from './library';
import library from '../../../public/miner-error-rules.json';
beforeEach(() => {vi.resetAllMocks(); api.getURL.mockImplementation(p => p); api.get.mockResolvedValue({}); api.set.mockResolvedValue(undefined); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: async () => structuredClone(library)}));});
it('initializes a missing cache from bundled rules', async () => {await loadLibrary(); expect(api.set).toHaveBeenCalledWith({atlasRuleLibrary: library});});
it('reuses an existing valid cache without writing it again', async () => {api.get.mockResolvedValue({atlasRuleLibrary: library}); await loadLibrary(); expect(api.set).not.toHaveBeenCalled();});
it('repairs changed or malformed cached knowledge', async () => {api.get.mockResolvedValue({atlasRuleLibrary: {...library, rules: []}}); await loadLibrary(); expect(api.set).toHaveBeenCalled();});
it('falls back to packaged knowledge when storage fails', async () => {api.get.mockRejectedValue(new Error('Storage unavailable')); expect(await loadLibrary()).toMatchObject({library, warning: expect.any(String)});});
it('rejects broken regex and unresolved placeholders', () => {
  const broken = structuredClone(library); broken.rules[0]!.match.pattern = '[';
  expect(() => validateLibrary(broken)).toThrow();
  const unknown = structuredClone(library); unknown.rules[0]!.title = '{{missing}}';
  expect(() => validateLibrary(unknown)).toThrow();
});
