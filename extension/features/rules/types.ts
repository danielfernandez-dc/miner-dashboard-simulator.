/** Shared contracts link the JSON library, analyzer, and side panel. Rules are
 * persistent knowledge; findings are temporary results from one log snapshot. */
export interface MatchRule { type: 'regex'; source: string; pattern: string; flags: string }
export interface Step { id: string; title: string; instruction: string }
export interface ErrorRule {
  id: string; severity: string; match: MatchRule; title: string; summary: string;
  procedureStatus: 'draft' | 'approved'; steps: Step[];
}
export interface RecoveryRule {
  id: string; severity: string; match: MatchRule; effect: 'clear-active-faults';
  clearsRuleIds: string[]; title: string; summary: string;
}
export interface RuleLibrary {
  schemaVersion: 1; rulesVersion: string; source: string;
  rules: ErrorRule[]; recoveryRules: RecoveryRule[];
}
