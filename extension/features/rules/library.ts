/** Loads bundled rules and reuses a validated, current copy in Chrome local
 * storage. New packaged versions replace old caches; miner logs are never saved. */
import { browser } from 'wxt/browser';
import type { RuleLibrary } from './types';

const key = 'atlasRuleLibrary';
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
export function validateLibrary(value: unknown): asserts value is RuleLibrary {
  if (!object(value) || value.schemaVersion !== 1 || !nonempty(value.rulesVersion) || value.source !== 'vnish-dashboard-simulator' || !Array.isArray(value.rules) || !value.rules.length || !Array.isArray(value.recoveryRules)) throw new Error('The troubleshooting library is invalid.');
  const ids = new Set<string>();
  for (const rule of [...value.rules, ...value.recoveryRules]) {
    if (!object(rule) || !nonempty(rule.id) || ids.has(rule.id) || !nonempty(rule.title) || !nonempty(rule.summary) || !nonempty(rule.severity) || !object(rule.match)) throw new Error('A troubleshooting rule is invalid.');
    ids.add(rule.id);
    const m = rule.match;
    if (m.type !== 'regex' || !nonempty(m.source) || !nonempty(m.pattern) || m.pattern.length > 2000 || typeof m.flags !== 'string' || !/^[imu]*$/.test(m.flags)) throw new Error('A matching pattern is invalid.');
    new RegExp(m.pattern, m.flags);
  }
  for (const rule of value.rules) {
    if (!['draft', 'approved'].includes(rule.procedureStatus) || !Array.isArray(rule.steps) || !rule.steps.length || rule.steps.some((s: unknown) => !object(s) || !nonempty(s.id) || !nonempty(s.title) || !nonempty(s.instruction))) throw new Error('A troubleshooting procedure is invalid.');
    const names = new Set(Array.from(rule.match.pattern.matchAll(/\(\?<([A-Za-z]\w*)>/g), (m: RegExpMatchArray) => m[1]));
    for (const text of [rule.title, rule.summary, ...rule.steps.flatMap((s: {title: string; instruction: string}) => [s.title, s.instruction])]) {
      for (const match of text.matchAll(/\{\{(\w+)\}\}/g)) if (!names.has(match[1])) throw new Error('A rule contains an unknown placeholder.');
    }
  }
  const errorRules = value.rules;
  for (const rule of value.recoveryRules) if (rule.effect !== 'clear-active-faults' || !Array.isArray(rule.clearsRuleIds) || rule.clearsRuleIds.some((id: unknown) => !errorRules.some((r: {id: string}) => r.id === id))) throw new Error('A recovery rule is invalid.');
}
export async function loadLibrary(): Promise<{library: RuleLibrary; warning?: string}> {
  const response = await fetch(browser.runtime.getURL('/miner-error-rules.json'));
  if (!response.ok) throw new Error('Unable to load the bundled troubleshooting library.');
  const bundled: unknown = await response.json();
  validateLibrary(bundled);
  try {
    const cached: unknown = (await browser.storage.local.get(key))[key];
    try {
      validateLibrary(cached);
      // Version equality alone cannot establish that a cached rule is unmodified.
      if (JSON.stringify(cached) === JSON.stringify(bundled)) return {library: cached};
    } catch { /* Missing or invalid cache is repaired from the packaged library. */ }
    await browser.storage.local.set({[key]: bundled});
    return {library: bundled};
  } catch {
    return {library: bundled, warning: 'Local storage is unavailable. Using the bundled rules for this session.'};
  }
}
