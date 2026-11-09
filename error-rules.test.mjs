/**
 * Checks the troubleshooting JSON against messages emitted by public/simulator.mjs.
 * These tests read the fixture without changing it and verify captures, templates,
 * and recovery declarations for an extension that consumes the rules.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSimulator } from './public/simulator.mjs';

const document = JSON.parse(await readFile(new URL('./public/miner-error-rules.json', import.meta.url), 'utf8'));
const matchingRules = entry => document.rules.filter(rule =>
  rule.severity === entry.level.toLowerCase() && rule.match.source === entry.source && new RegExp(rule.match.pattern, rule.match.flags).test(entry.message));

test('registered scenarios match exactly one rule with usable template captures', () => {
  assert.equal(document.schemaVersion, 1);
  assert.equal(document.source, 'vnish-dashboard-simulator');
  assert.equal(new Set(document.rules.map(rule => rule.id)).size, document.rules.length);
  const sim = createSimulator();
  const expected = {
    chain: { id: 'hashboard-enumeration-failed', groups: { chain: '2', found: '0', expected: '126' } },
    temperature: { id: 'chip-temperature-limit-exceeded', groups: { chain: '1', temperature: '92', limit: '85' } },
    fan: { id: 'fan-speed-below-minimum', groups: { fan: '2', rpm: '0', minimum: '1000' } },
    pool: { id: 'pool-connection-interrupted', groups: { pool: '0', reason: 'connection timed out' } },
    psu: { id: 'power-supply-initialization-failed', groups: { voltage: '10.2' } },
  };
  for (const [scenario, expectedMatch] of Object.entries(expected)) {
    sim.setScenario(scenario);
    const entry = sim.state.logs.at(-1);
    const matches = matchingRules(entry);
    assert.equal(matches.length, 1, scenario);
    const rule = matches[0];
    assert.equal(rule.id, expectedMatch.id);
    assert.equal(rule.severity, 'error');
    assert.equal(rule.procedureStatus, 'draft');
    const match = new RegExp(rule.match.pattern, rule.match.flags).exec(entry.message);
    assert.deepEqual({ ...match.groups }, expectedMatch.groups);
    const templates = [rule.title, rule.summary, ...rule.steps.flatMap(step => [step.title, step.instruction])];
    for (const template of templates) {
      for (const [, name] of template.matchAll(/\{\{(\w+)\}\}/g)) assert.ok(Object.hasOwn(match.groups, name), name);
    }
    // Matching must honor the log source, not only its text.
    assert.equal(matchingRules({ ...entry, source: 'unrelated' }).length, 0);
  }
});

test('healthy and unknown messages do not match fault rules', () => {
  const sim = createSimulator();
  for (const entry of sim.state.logs) assert.equal(matchingRules(entry).length, 0);
  assert.equal(matchingRules({ level: 'ERROR', source: 'miner', message: 'Unrecognized diagnostic fault' }).length, 0);
  sim.setScenario('fan');
  assert.equal(matchingRules({ ...sim.state.logs.at(-1), level: 'INFO' }).length, 0);
});

test('explicit recovery clears registered faults, but shares and later faults remain distinct', () => {
  const sim = createSimulator();
  sim.setScenario('chain');
  const fault = sim.state.logs.at(-1);
  sim.setScenario('healthy');
  const [share, recovery] = sim.state.logs.slice(-2);
  const recoveryMatches = entry => document.recoveryRules.filter(rule =>
    rule.severity === entry.level.toLowerCase() && rule.match.source === entry.source &&
    new RegExp(rule.match.pattern, rule.match.flags).test(entry.message));
  assert.equal(recoveryMatches(fault).length, 0);
  assert.equal(recoveryMatches(share).length, 0);
  const matches = recoveryMatches(recovery);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].effect, 'clear-active-faults');
  assert.deepEqual(new Set(matches[0].clearsRuleIds), new Set(document.rules.map(rule => rule.id)));
  assert.equal(recoveryMatches({ ...recovery, source: 'miner' }).length, 0);
  assert.equal(recoveryMatches({ ...recovery, level: 'ERROR' }).length, 0);
  assert.equal(matchingRules(recovery).length, 0);
  sim.setScenario('chain');
  assert.equal(matchingRules(sim.state.logs.at(-1))[0].id, 'hashboard-enumeration-failed');
});
