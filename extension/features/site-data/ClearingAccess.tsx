/** Requests the optional access needed to clear cross-origin frame sessions and
 * third-party partitioned cookies. Chrome presents its permission dialog only
 * from this explicit click; a successful grant reruns the opening cleanup. */
import {useState} from 'react';
import {browser} from 'wxt/browser';
import {fullSiteAccess} from './clearSiteData';
export function ClearingAccess({onGranted}: {onGranted: () => void}) {
  const [message, setMessage] = useState('One-time website access is needed to clear embedded pages and partitioned third-party cookies.');
  const [busy, setBusy] = useState(false);
  async function enable() {
    setBusy(true);
    try {
      const granted = await browser.permissions.request({origins:fullSiteAccess});
      if (granted) {await browser.runtime.sendMessage({type:'atlas:reset-clearing'}); onGranted();}
      else setMessage('Website access was not granted. Complete clearing is not enabled.');
    } catch {setMessage('Unable to enable complete clearing. Please try again.');}
    finally {setBusy(false);}
  }
  return <section className="clearing-access"><p>{message}</p><button disabled={busy} onClick={() => void enable()}>{busy ? 'Enabling…' : 'Enable complete site clearing'}</button></section>;
}
