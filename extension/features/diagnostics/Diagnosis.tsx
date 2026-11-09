/** Displays one finding from analyze.ts as a concise issue, numbered procedure,
 * and optional evidence. Expanding evidence changes UI state only. */
import type { Finding } from './analyze';
export function Diagnosis({finding}: {finding: Finding}) {
  return <>
    <section className="issue-card" aria-labelledby="issue-title">
      <span className="badge">{finding.ruleId ? 'Action needed' : 'Review needed'}</span>
      <h2 id="issue-title">{finding.title}</h2><p>{finding.summary}</p>
    </section>
    {finding.title.includes('Chain ') && <p className="hint">Chain numbering follows the miner log.</p>}
    {finding.steps.length > 0 && <section className="steps" aria-labelledby="steps-title">
      <div className="section-heading"><h2 id="steps-title">Next steps</h2><span>{finding.steps.length} steps</span></div>
      <ol>{finding.steps.map((step, i) => <li key={step.id}><span className="step-number" aria-hidden="true">{i + 1}</span><div><h3>{step.title}</h3><p>{step.instruction}</p></div></li>)}</ol>
      {finding.procedureStatus === 'draft' && <p className="draft-note">Example procedure · pending team review</p>}
    </section>}
    <details className="evidence" key={finding.key}><summary>Why this recommendation?</summary><pre>{finding.evidence}</pre><p>{finding.repeats} {finding.repeats === 1 ? 'occurrence' : 'occurrences'} in this log snapshot.</p></details>
  </>;
}
