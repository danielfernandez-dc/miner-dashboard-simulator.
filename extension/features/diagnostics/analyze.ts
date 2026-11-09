/** Turns a complete log snapshot into current findings for the panel. Entries are
 * replayed in log order so recovery clears earlier faults and later faults recur.
 * Everything stays in memory; this module never reads pages or persists logs. */
import type { RuleLibrary, Step } from '../rules/types';
export interface LogEntry { timestamp: string; level: string; source: string; message: string; raw: string }
export interface Finding {
  key: string; ruleId?: string; title: string; summary: string; steps: Step[];
  procedureStatus?: 'draft' | 'approved'; evidence: string; timestamp: string; repeats: number;
}
export interface Analysis { findings: Finding[]; parsed: number; skipped: number; recovered: boolean }
export function parseLine(raw: string): LogEntry | null {
  const m = /^\[([^\]]+)\]\s+(INFO|ERROR|WARN|WARNING|DEBUG|FATAL)\s+(\w[\w.-]*):\s*(.+)$/i.exec(raw.trim());
  return m ? {timestamp: m[1]!, level: m[2]!.toLowerCase(), source: m[3]!.toLowerCase(), message: m[4]!, raw} : null;
}
export function analyze(text: string, library: RuleLibrary): Analysis {
  const active = new Map<string, Finding>();
  let parsed = 0, skipped = 0, recovered = false;
  const rules = library.rules.map(rule => ({rule, regex: new RegExp(rule.match.pattern, rule.match.flags)}));
  const recoveries = library.recoveryRules.map(rule => ({rule, regex: new RegExp(rule.match.pattern, rule.match.flags)}));
  for (const raw of text.split(/\r?\n/).filter(line => line.trim())) {
    const entry = parseLine(raw);
    if (!entry) { skipped++; continue; }
    parsed++;
    if (entry.source === 'system' && entry.level === 'info' && entry.message.startsWith('Linux boot:')) { active.clear(); recovered = false; }
    for (const {rule, regex} of recoveries) {
      if (rule.severity === entry.level && rule.match.source === entry.source && regex.test(entry.message)) {
        for (const [key, finding] of active) if (finding.ruleId && rule.clearsRuleIds.includes(finding.ruleId)) active.delete(key);
        recovered = true;
      }
    }
    if (!['error', 'fatal', 'warn', 'warning'].includes(entry.level)) continue;
    let matched = false;
    for (const {rule, regex} of rules) {
      if (rule.severity !== entry.level || rule.match.source !== entry.source) continue;
      const match = regex.exec(entry.message);
      if (!match) continue;
      matched = true;
      const groups = match.groups ?? {};
      const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, name: string) => groups[name] ?? 'unknown');
      // Measurements can vary; component identity distinguishes separate faults.
      const component = groups.chain ?? groups.fan ?? groups.pool ?? '';
      const key = `${rule.id}:${component}`;
      const repeats = (active.get(key)?.repeats ?? 0) + 1;
      active.delete(key);
      active.set(key, {key, ruleId: rule.id, title: fill(rule.title), summary: fill(rule.summary), steps: rule.steps.map(s => ({id: s.id, title: fill(s.title), instruction: fill(s.instruction)})), procedureStatus: rule.procedureStatus, evidence: raw, timestamp: entry.timestamp, repeats});
    }
    if (!matched) {
      const key = `unknown:${entry.source}:${entry.message}`;
      const repeats = (active.get(key)?.repeats ?? 0) + 1;
      active.delete(key);
      active.set(key, {key, title: 'Unrecognized log warning or error', summary: 'No matching procedure is available. Share this log with your lead technician.', steps: [], evidence: raw, timestamp: entry.timestamp, repeats});
    }
    recovered = false;
  }
  return {findings: Array.from(active.values()).reverse(), parsed, skipped, recovered};
}
