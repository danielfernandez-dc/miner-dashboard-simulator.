/** Coordinates the Atlas workflow: load the cached rule library, read the active
 * simulator, and render Diagnosis. Findings and selection live only in React;
 * the library service persists rules and the background worker archives unknown errors. Preview mode is explicitly labeled
 * and uses local fixtures, never pretending to have connected to a miner. */
import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { analyze, type Analysis } from '../../features/diagnostics/analyze';
import { Diagnosis } from '../../features/diagnostics/Diagnosis';
import { readMiner, type MinerSnapshot } from '../../features/miner/readMiner';
import { loadLibrary, validateLibrary } from '../../features/rules/library';
import type { RuleLibrary } from '../../features/rules/types';
import { UnknownErrors } from '../../features/errors/UnknownErrors';
import { makeUnknownErrors } from '../../features/errors/archive';
import type {ClearingResult} from '../../features/site-data/clearSiteData';
import {ClearingAccess} from '../../features/site-data/ClearingAccess';
import { previewSnapshot, previewScenarios } from './preview';

const preview = !browser?.runtime?.id;
type View = {snapshot: MinerSnapshot; analysis: Analysis};
export function App() {
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [clearing, setClearing] = useState<ClearingResult | {status: 'clearing'; message: string}>();
  const [selected, setSelected] = useState('');
  const [scenario, setScenario] = useState('chain');
  const [library, setLibrary] = useState<RuleLibrary>();
  const request = useRef(0);
  const targetTab = useRef<number | null>(null);
  const libraryPromise = useRef<ReturnType<typeof loadLibrary> | null>(null);

  async function read(nextScenario = scenario) {
    const generation = ++request.current;
    setBusy(true); setError(''); setView(null); setSelected(''); targetTab.current = null;
    try {
      libraryPromise.current ??= preview
        ? fetch('/miner-error-rules.json').then(async response => {
            if (!response.ok) throw new Error('Unable to load preview rules.');
            const data: unknown = await response.json(); validateLibrary(data); return {library: data};
          })
        : loadLibrary();
      const {library: rules, warning: cacheWarning} = await libraryPromise.current;
      if (!preview) {
        setClearing({status: 'clearing', message: 'Clearing this website’s stored data, cookies, and service workers… This can sign you out.'});
        // Stored-data deletion may take tens of seconds; reading logs need not wait.
        void browser.runtime.sendMessage({type: 'atlas:prepare-read'}).then((result: ClearingResult) => {
          if (generation === request.current) setClearing(result);
        }).catch(() => {if (generation === request.current) setClearing({status: 'failed', completedAt: Date.now(), message: 'Unable to confirm site-data clearing. Close Atlas and open it again to retry.'});});
      }
      const snapshot = preview ? previewSnapshot(nextScenario) : await readMiner();
      if (generation !== request.current) return;
      targetTab.current = snapshot.tabId;
      const analysis = analyze(snapshot.text, rules);
      setLibrary(rules); setWarning(cacheWarning ?? ''); setView({snapshot, analysis});
      if (!preview && analysis.unknownEntries.length) {
        try {
          const incoming = await makeUnknownErrors(analysis.unknownEntries, snapshot.origin, snapshot.name);
          const saved = await browser.runtime.sendMessage({type: 'atlas:archive-errors', archive: incoming});
          if (saved?.error || !saved?.archive) throw new Error(saved?.error ?? 'Unknown-error storage did not confirm the save.');
        } catch {if (generation === request.current) setWarning('The diagnosis is available, but unknown errors could not be saved. Read again to retry.');}
      }
    } catch (e) {
      if (generation !== request.current) return;
      libraryPromise.current = null;
      setError(e instanceof Error ? e.message : 'Unable to read this miner. Please try again.');
    } finally { if (generation === request.current) setBusy(false); }
  }
  useEffect(() => {
    void read();
    if (preview) return () => {request.current++;};
    // Never display one miner's advice alongside another tab or navigated page.
    const invalidate = () => {request.current++; setView(null); setBusy(false); setError('Tab changed. Click the Atlas button on the simulator tab, then read the logs again.');};
    const onUpdated = (id: number, change: {status?: string; url?: string}) => {if ((targetTab.current === null || id === targetTab.current) && (change.status === 'loading' || change.url)) invalidate();};
    browser.tabs.onActivated.addListener(invalidate);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {request.current++; browser.tabs.onActivated.removeListener(invalidate); browser.tabs.onUpdated.removeListener(onUpdated);};
  }, []);
  const findings = view?.analysis.findings ?? [];
  const finding = findings.find(f => f.key === selected) ?? findings[0];
  return <div className={`panel-shell${preview ? ' preview-shell' : ''}`}>
    <header className="panel-header"><div><div className="brand"><img className="brand-mark" src="/atlas-mark.svg" alt=""/> ATLAS</div><p>Miner troubleshooting</p></div><button className="icon-button" aria-label="Close Atlas" onClick={() => window.close()}>×</button></header>
    {preview && <aside className="preview-bar"><strong>Design preview · simulated data</strong><label htmlFor="preview-scenario">Preview scenario</label><select id="preview-scenario" value={scenario} onChange={e => {setScenario(e.target.value); void read(e.target.value);}}>{previewScenarios.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></aside>}
    <main>
      {clearing && <p className={`clearing-status ${clearing.status}`} role="status">{clearing.message}</p>}
      {clearing && 'needsAccess' in clearing && clearing.needsAccess && <ClearingAccess onGranted={() => void read()}/>}
      <div className="miner-card"><div className="miner-label">CURRENT MINER</div><h1>{view?.snapshot.name ?? 'Miner Lab simulator'}</h1><p>{view?.snapshot.host ?? 'Open the simulator to begin'}</p><span className="source-tag">Simulator</span></div>
      <div aria-live="polite" aria-busy={busy}>
        {busy ? <section className="state-card"><span className="spinner" aria-hidden="true"/><h2>Reading miner…</h2><p>Checking the troubleshooting library and latest logs.</p></section>
          : error ? <section className="state-card error-state" role="alert"><span className="status-icon">!</span><h2>Unable to read logs</h2><p>{error}</p></section>
          : view && finding ? <>
            {findings.length > 1 && <div className="finding-selector"><label htmlFor="finding">{findings.length} findings · latest first</label><select id="finding" value={finding.key} onChange={e => setSelected(e.target.value)}>{findings.map(f => <option key={f.key} value={f.key}>{f.title}</option>)}</select></div>}
            <Diagnosis finding={finding}/>
          </> : view ? <section className="state-card"><span className={`status-icon ${view.analysis.recovered ? 'recovered' : ''}`}>{view.analysis.recovered ? '✓' : '—'}</span><h2>{!view.snapshot.text.trim() ? 'The log is empty' : !view.analysis.parsed ? 'Log format not recognized' : view.analysis.recovered ? 'Miner resumed normal operation' : 'No recognized faults found'}</h2><p>{!view.snapshot.text.trim() ? 'Let the simulator produce logs, then read again.' : !view.analysis.parsed ? 'These entries could not be analyzed. Ask your lead technician to review the log format.' : view.analysis.recovered ? 'The simulator reports that its fault conditions have cleared.' : 'No active errors were identified in the available log snapshot. This is not a hardware health check.'}</p></section> : null}
      </div>
      {view && view.analysis.skipped > 0 && <p className="notice">{view.analysis.skipped} log {view.analysis.skipped === 1 ? 'line was' : 'lines were'} not recognized and could not be checked.</p>}
      {warning && <p className="notice">{warning}</p>}
      <button className="primary-button w-full transition-colors hover:bg-[#ffae35] disabled:opacity-50" disabled={busy} onClick={() => void read()}><span aria-hidden="true">↻</span> {busy ? 'Reading logs…' : 'Read logs again'}</button>
      {view && <p className="read-time">Snapshot read at {new Date(view.snapshot.readAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'})} · {view.analysis.parsed} {view.analysis.parsed === 1 ? 'entry' : 'entries'}</p>}
      {!preview && <UnknownErrors/>}
    </main>
    <footer><span className="footer-dot"/> {preview ? 'Preview only' : 'Simulator data'} · Processed in your browser{library && <span className="rules-version">Rules {library.rulesVersion}</span>}</footer>
  </div>;
}
