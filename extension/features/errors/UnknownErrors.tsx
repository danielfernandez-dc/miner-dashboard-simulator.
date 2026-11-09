/** Shows the persistent unknown-error inbox and one-time file connection. Chrome
 * storage is authoritative; authorized errors.json writes merge its existing
 * records. The file picker only opens from a direct technician button click. */
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { archiveKey, getArchive, type ErrorArchive } from './archive';
import { connectErrorFile, syncErrorFile } from './file';
export function UnknownErrors() {
  const [archive, setArchive] = useState<ErrorArchive>();
  const [notice, setNotice] = useState('Saved automatically in Chrome. Connect errors.json to also save to your folder.');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    let generation = 0;
    async function refresh() {
      const current = ++generation;
      try {
        const data = await getArchive();
        if (!active || generation !== current) return;
        setArchive(data);
        const state = await syncErrorFile(data);
        if (active && generation === current) setNotice(state === 'synced' ? 'Saved in Chrome and synced to your connected errors.json file.' : 'Saved automatically in Chrome. Connect errors.json to also save to your folder.');
      } catch (error) {if (active) setNotice(error instanceof Error ? error.message : 'Unable to sync errors.json. Errors remain in Chrome.');}
    }
    const onChanged = (changes: Record<string, unknown>, area: string) => {if (area === 'local' && archiveKey in changes) void refresh();};
    void refresh(); browser.storage.onChanged.addListener(onChanged);
    return () => {active = false; generation++; browser.storage.onChanged.removeListener(onChanged);};
  }, []);
  async function connect() {
    if (!archive) return;
    setBusy(true);
    try {await connectErrorFile(archive); setNotice('Connected. Unknown errors will also be saved to this errors.json file.');}
    catch (error) {if (!(error instanceof DOMException && error.name === 'AbortError')) setNotice(error instanceof Error ? error.message : 'Unable to connect errors.json.');}
    finally {setBusy(false);}
  }
  return <section className="unknown-inbox" aria-label="Saved unrecognized errors"><h2>Unrecognized errors <span>{archive?.errors.length ?? '…'}</span></h2><p aria-live="polite">{notice}</p><button disabled={busy || !archive} onClick={() => void connect()}>{busy ? 'Connecting…' : 'Connect errors.json'}</button></section>;
}
