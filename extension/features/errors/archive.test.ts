/** Covers durable capture of unknown entries without duplicates or loss from
 * overlapping reads. Storage failures remain visible and never erase old data. */
import {beforeEach, expect, it, vi} from 'vitest';
const api = vi.hoisted(() => ({get:vi.fn(), set:vi.fn()}));
vi.mock('wxt/browser', () => ({browser: {storage: {local: api}}}));
import {appendUnknownErrors, archiveKey, emptyArchive, makeUnknownErrors, mergeArchives} from './archive';
import {parseLine} from '../diagnostics/analyze';
const entry = parseLine('[2026-11-09 12:00:00] ERROR miner: Unknown chip fault 999')!;
beforeEach(() => {api.get.mockReset(); api.set.mockReset(); let data: Record<string, unknown> = {}; api.get.mockImplementation(async () => data); api.set.mockImplementation(async v => {data = {...data, ...v};});});
it('deduplicates repeated snapshots but preserves later events and different miners', async () => {
  const a = await makeUnknownErrors([entry], 'miner-1', 'Miner 1');
  const duplicate = await makeUnknownErrors([entry], 'miner-1', 'Miner 1');
  const other = await makeUnknownErrors([entry], 'miner-2', 'Miner 2');
  const later = await makeUnknownErrors([{...entry, raw: entry.raw.replace('12:00:00', '12:00:01')}], 'miner-1', 'Miner 1');
  expect(mergeArchives(a, duplicate, other, later).errors).toHaveLength(3);
});
it('serializes simultaneous panel writes without overwriting either error', async () => {
  const a = await makeUnknownErrors([entry], 'miner-1', 'Miner 1');
  const b = await makeUnknownErrors([entry], 'miner-2', 'Miner 2');
  await Promise.all([appendUnknownErrors(a), appendUnknownErrors(b)]);
  expect((await api.get())[archiveKey].errors).toHaveLength(2);
});
it('does not replace malformed existing storage with an empty archive', async () => {
  api.get.mockResolvedValue({[archiveKey]: {broken: true}});
  await expect(appendUnknownErrors(emptyArchive())).rejects.toThrow(); expect(api.set).not.toHaveBeenCalled();
});
it('can retry after a storage write fails', async () => {
  api.set.mockRejectedValueOnce(new Error('Quota'));
  const data = await makeUnknownErrors([entry], 'miner-1', 'Miner 1');
  await expect(appendUnknownErrors(data)).rejects.toThrow();
  expect((await appendUnknownErrors(data)).errors).toHaveLength(1);
});
