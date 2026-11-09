/** Verifies the file write boundary preserves prior records and refuses to
 * overwrite an unrelated or malformed JSON file selected by the technician. */
import {expect, it, vi} from 'vitest';
vi.mock('wxt/browser', () => ({browser: {}}));
import {writeMergedFile} from './file';
import {makeUnknownErrors} from './archive';
import {parseLine} from '../diagnostics/analyze';
const record = parseLine('[2026-11-09 12:00:00] ERROR miner: Unrecognized diagnostic')!;
function fileHandle(text: string) {
  const writable = {write: vi.fn(), close: vi.fn(), abort: vi.fn().mockResolvedValue(undefined)};
  const handle = {getFile: async () => ({size: text.length, text: async () => text}), createWritable: vi.fn().mockResolvedValue(writable)};
  return {handle: handle as unknown as Parameters<typeof writeMergedFile>[0], writable, create: handle.createWritable};
}
it('merges existing file entries instead of losing them', async () => {
  const old = await makeUnknownErrors([record], 'first-miner', 'First');
  const incoming = await makeUnknownErrors([record], 'second-miner', 'Second');
  const f = fileHandle(JSON.stringify(old)); await writeMergedFile(f.handle, incoming);
  expect(JSON.parse(f.writable.write.mock.calls[0]![0]).errors).toHaveLength(2); expect(f.writable.close).toHaveBeenCalledOnce();
});
it('does not start a write for malformed or unrelated JSON', async () => {
  for (const text of ['{invalid', '{"rules":[]}']) {
    const f = fileHandle(text); await expect(writeMergedFile(f.handle, {schemaVersion:1, errors:[]})).rejects.toThrow(); expect(f.create).not.toHaveBeenCalled();
  }
});
it('aborts a failed write rather than committing a partial file', async () => {
  const f = fileHandle('{"schemaVersion":1,"errors":[]}'); f.writable.write.mockRejectedValue(new Error('Disk full'));
  await expect(writeMergedFile(f.handle, {schemaVersion:1, errors:[]})).rejects.toThrow(); expect(f.writable.abort).toHaveBeenCalledOnce(); expect(f.writable.close).not.toHaveBeenCalled();
});
