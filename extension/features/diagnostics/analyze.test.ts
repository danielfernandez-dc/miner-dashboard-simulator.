/** Protects the diagnostic workflow against stale faults, lost component identity,
 * and unsafe guesses. Test messages come from the actual simulator implementation. */
import { describe, expect, it } from 'vitest';
import { analyze } from './analyze';
import libraryJson from '../../../public/miner-error-rules.json';
import type { RuleLibrary } from '../rules/types';
// The independent JavaScript simulator is intentionally outside the extension.
// @ts-expect-error The simulator fixture has no TypeScript declaration.
import { createSimulator, scenarios, logText } from '../../../public/simulator.mjs';
const library = libraryJson as RuleLibrary;
const line = (message: string, level = 'ERROR', source = 'miner') => `[2026-11-09 10:24:11.000] ${level} ${source}: ${message}`;
describe('diagnostic analysis', () => {
  it('recognizes all five real simulator scenarios and fills every step', () => {
    for (const scenario of Object.keys(scenarios).filter(k => !['healthy', 'unknown'].includes(k))) {
      const sim = createSimulator(); sim.setScenario(scenario);
      const result = analyze(logText(sim.state.logs), library);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]!.ruleId).toBeTruthy();
      expect(JSON.stringify(result.findings)).not.toContain('{{');
      expect(result.findings[0]!.steps).toHaveLength(3);
    }
  });
  it('clears previous faults on recovery and recognizes subsequent recurrence', () => {
    const sim = createSimulator(); sim.setScenario('chain'); sim.setScenario('fan'); sim.setScenario('healthy');
    expect(analyze(logText(sim.state.logs), library)).toMatchObject({findings: [], recovered: true});
    sim.setScenario('pool');
    expect(analyze(logText(sim.state.logs), library).findings[0]!.ruleId).toBe('pool-connection-interrupted');
  });
  it('does not equate accepted shares with clearing a failed hashboard', () => {
    const sim = createSimulator(); sim.setScenario('chain');
    sim.add('INFO', 'miner', 'Accepted share #25 diff 65536; chain 0');
    expect(analyze(logText(sim.state.logs), library).findings).toHaveLength(1);
  });
  it('groups repeated errors but preserves separate components', () => {
    const message = scenarios.chain[3];
    const result = analyze([line(message), line(message), line(message.replace('Chain 2', 'Chain 1'))].join('\n'), library);
    expect(result.findings).toHaveLength(2);
    expect(result.findings[0]!.title).toBe('Chain 1 not detected');
    expect(result.findings[1]!.repeats).toBe(2);
  });
  it('keeps unknown faults visible after a recovery only clears known rules', () => {
    const sim = createSimulator(); sim.add('ERROR', 'miner', '<script>unexpected fault</script>'); sim.setScenario('healthy');
    const result = analyze(logText(sim.state.logs), library);
    expect(result.findings).toHaveLength(1); expect(result.findings[0]!.ruleId).toBeUndefined();
    expect(result.findings[0]!.steps).toEqual([]);
  });
  it('rejects wrong sources and levels, and reports malformed lines', () => {
    expect(analyze(line(scenarios.fan[3], 'INFO', 'system'), library).findings).toHaveLength(0);
    expect(analyze(line(scenarios.fan[3], 'ERROR', 'miner'), library).findings[0]!.ruleId).toBeUndefined();
    expect(analyze('invalid log data', library)).toMatchObject({parsed: 0, skipped: 1});
    expect(analyze('', library)).toMatchObject({parsed: 0, skipped: 0, findings: []});
  });
  it('resets active history at a new boot within the retained buffer', () => {
    expect(analyze([line(scenarios.chain[3]), line('Linux boot: new session', 'INFO', 'system')].join('\n'), library).findings).toHaveLength(0);
  });
});

it('retains unknown entries for archiving even if a later boot clears the screen', () => {
  const result = analyze([line('Unrecognized fault'), line('Linux boot: new session', 'INFO', 'system')].join('\n'), library);
  expect(result.findings).toHaveLength(0);
  expect(result.unknownEntries).toHaveLength(1);
});

it('archives the simulator’s deliberately unregistered fault', () => {
  const sim = createSimulator(); sim.setScenario('unknown');
  const result = analyze(logText(sim.state.logs), library);
  expect(result.unknownEntries).toHaveLength(1);
  expect(result.findings[0]?.ruleId).toBeUndefined();
});
