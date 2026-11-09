import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulator, scenarios, logText } from './public/simulator.mjs';

test('each fault produces a readable error and changes the corresponding telemetry', () => {
  const sim = createSimulator();
  for (const name of Object.keys(scenarios).filter(name => name !== 'healthy')) {
    sim.setScenario(name);
    const state = sim.snapshot();
    assert.equal(state.logs.at(-1).level, 'ERROR');
    assert.ok(logText(state.logs).includes(scenarios[name][3]));
    if (name === 'temperature') assert.equal(state.temperature, 92);
    if (name === 'fan') assert.equal(state.fans[1], 0);
    if (name === 'chain') assert.equal(state.hashrate, 73.2);
    if (['psu', 'pool', 'fan', 'temperature'].includes(name)) assert.equal(state.hashrate, 0);
  }
  sim.setScenario('healthy');
  assert.ok(sim.snapshot().hashrate > 0);
  assert.equal(sim.snapshot().temperature, 67);
  assert.ok(sim.snapshot().fans.every(rpm => rpm > 0));
});
test('pause stops generation, reset recovers faults, and retention is bounded', () => {
  const sim = createSimulator();
  sim.state.running = false;
  const count = sim.state.logs.length;
  sim.tick();
  assert.equal(sim.state.logs.length, count);
  sim.setScenario('fan'); sim.reset();
  assert.equal(sim.state.scenario, 'healthy');
  assert.equal(sim.state.running, true);
  for (let i = 0; i < 2100; i++) sim.tick();
  assert.equal(sim.state.logs.length, 2000);
  assert.ok(sim.state.logs[0].id < sim.state.logs.at(-1).id);
});
