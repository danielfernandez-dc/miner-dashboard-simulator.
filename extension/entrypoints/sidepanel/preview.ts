/** Explicit design-preview fixtures let the panel be inspected outside Chrome's
 * extension runtime. Production reads always go through readMiner instead. */
import type { MinerSnapshot } from '../../features/miner/readMiner';
export const previewScenarios = [
  {id: 'chain', label: 'Missing hashboard'}, {id: 'temperature', label: 'Overtemperature'},
  {id: 'fan', label: 'Fan failure'}, {id: 'pool', label: 'Pool disconnected'},
  {id: 'psu', label: 'Power supply fault'}, {id: 'recovered', label: 'Recovered'},
  {id: 'unknown', label: 'Unknown error'}, {id: 'empty', label: 'Empty log'},
];
const messages: Record<string, string> = {
  chain: 'ERROR miner: Chain 2 ASIC enumeration failed: found 0 of 126 chips; hashboard disabled',
  temperature: 'ERROR miner: Chain 1 chip temperature 92 C exceeds limit 85 C; thermal protection activated',
  fan: 'ERROR system: Fan 2 speed 0 RPM below minimum 1000 RPM; fan lost, mining stopped',
  pool: 'ERROR miner: Stratum connection to pool 0 interrupted: connection timed out; reconnecting',
  psu: 'ERROR system: PSU voltage abnormal: 10.2 V; power supply initialization failed',
  unknown: 'ERROR miner: Unexpected diagnostic code 999',
};
export function previewSnapshot(scenario: string): MinerSnapshot {
  const stamp = '[2026-11-09 10:24:11.000] ';
  const lines = scenario === 'empty' ? [] : scenario === 'recovered'
    ? [messages.chain, 'INFO system: Fault conditions cleared; miner resumed normal operation'] : [messages[scenario] ?? messages.chain];
  return {text: lines.map(s => stamp + s).join('\n'), name: 'Antminer S19 Pro', host: 'atlas-lab · Design preview', complete: true, readAt: Date.now(), tabId: -1};
}
